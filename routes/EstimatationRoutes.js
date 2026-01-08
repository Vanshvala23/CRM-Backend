const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');

/* ==============================
   GENERATE ESTIMATE NUMBER
================================ */
async function generateEstimateNumber(conn) {
  const [[row]] = await conn.query(
    `SELECT estimate_number
     FROM estimates
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`
  );

  let next = 1;
  if (row?.estimate_number) {
    next = parseInt(row.estimate_number.replace('EST-', '')) + 1;
  }

  return `EST-${String(next).padStart(6, '0')}`;
}

/* ==============================
   GENERATE INVOICE NUMBER
================================ */
async function generateInvoiceNumber(conn) {
  const [[row]] = await conn.query(
    `SELECT inv_no
     FROM invoice
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`
  );

  let next = 1;
  if (row?.inv_no) {
    next = parseInt(row.inv_no.replace('INV-', '')) + 1;
  }

  return `INV-${String(next).padStart(6, '0')}`;
}

/* ==============================
   CREATE ESTIMATE
================================ */
router.post('/', async (req, res) => {
  const {
    customer_id,
    bill_to,
    ship_to,
    issue_date,
    expiry_date,
    items,
    terms_conditions
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ message: 'Items required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const estimate_number = await generateEstimateNumber(conn);

    let sub_total = 0;
    let tax = 0;

    items.forEach(i => {
      const amt = i.qty * i.rate;
      sub_total += amt;
      tax += amt * (i.tax / 100);
    });

    const final_total = sub_total + tax;

    const [result] = await conn.query(
      `INSERT INTO estimates
      (estimate_number, customer_id, bill_to, ship_to,
       issue_date, expiry_date, sub_total, tax, final_total,
       terms_conditions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [
        estimate_number,
        customer_id,
        bill_to,
        ship_to,
        issue_date,
        expiry_date,
        sub_total,
        tax,
        final_total,
        terms_conditions
      ]
    );

    for (const i of items) {
      await conn.query(
        `INSERT INTO estimate_items
        (estimate_id, item_name, qty, rate, tax, amount)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          i.item_name,
          i.qty,
          i.rate,
          i.tax,
          i.qty * i.rate
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Estimate created', estimate_number });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* ==============================
   UPDATE ESTIMATE
================================ */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { bill_to, ship_to, issue_date, expiry_date, items, terms_conditions } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let sub_total = 0;
    let tax = 0;

    items.forEach(i => {
      const amt = i.qty * i.rate;
      sub_total += amt;
      tax += amt * (i.tax / 100);
    });

    const final_total = sub_total + tax;

    await conn.query(
      `UPDATE estimates SET
       bill_to=?, ship_to=?, issue_date=?, expiry_date=?,
       sub_total=?, tax=?, final_total=?, terms_conditions=?
       WHERE id=?`,
      [
        bill_to,
        ship_to,
        issue_date,
        expiry_date,
        sub_total,
        tax,
        final_total,
        terms_conditions,
        id
      ]
    );

    await conn.query(`DELETE FROM estimate_items WHERE estimate_id=?`, [id]);

    for (const i of items) {
      await conn.query(
        `INSERT INTO estimate_items
        (estimate_id, item_name, qty, rate, tax, amount)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [id, i.item_name, i.qty, i.rate, i.tax, i.qty * i.rate]
      );
    }

    await conn.commit();
    res.json({ message: 'Estimate updated' });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* ==============================
   STATUS WORKFLOW
================================ */
router.patch('/:id/status', async (req, res) => {
  const allowed = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  await db.query(
    `UPDATE estimates SET status=? WHERE id=?`,
    [req.body.status, req.params.id]
  );

  res.json({ message: 'Status updated' });
});

/* ==============================
   CONVERT TO INVOICE
================================ */
router.post('/:id/convert', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[estimate]] = await conn.query(
      `SELECT e.*, c.name AS customer_name
       FROM estimates e
       JOIN contact c ON c.id=e.customer_id
       WHERE e.id=? AND e.status='Accepted'`,
      [req.params.id]
    );

    if (!estimate) {
      return res.status(400).json({ message: 'Estimate not accepted' });
    }

    const inv_no = await generateInvoiceNumber(conn);

    const [invoice] = await conn.query(
      `INSERT INTO invoice
      (inv_no, bill_to, ship_to, company_name,
       sub_total, tax, total, issue_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'Draft')`,
      [
        inv_no,
        estimate.bill_to,
        estimate.ship_to,
        estimate.customer_name,
        estimate.sub_total,
        estimate.tax,
        estimate.final_total
      ]
    );

    const [items] = await conn.query(
      `SELECT * FROM estimate_items WHERE estimate_id=?`,
      [estimate.id]
    );

    for (const i of items) {
      await conn.query(
        `INSERT INTO invoice_items
        (invoice_id, item_name, qty, rate, tax, amount)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice.insertId, i.item_name, i.qty, i.rate, i.tax, i.amount]
      );
    }

    await conn.query(
      `UPDATE estimates SET status='Converted' WHERE id=?`,
      [estimate.id]
    );

    await conn.commit();
    res.json({ message: 'Converted to invoice', inv_no });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* ==============================
   PDF GENERATION
================================ */
router.get('/:id/pdf', async (req, res) => {
  const [[estimate]] = await db.query(
    `SELECT e.*, c.name customer_name
     FROM estimates e
     JOIN contact c ON c.id=e.customer_id
     WHERE e.id=?`,
    [req.params.id]
  );

  const [items] = await db.query(
    `SELECT * FROM estimate_items WHERE estimate_id=?`,
    [req.params.id]
  );

  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(20).text('ESTIMATE', { align: 'center' });
  doc.text(`Estimate No: ${estimate.estimate_number}`);
  doc.text(`Customer: ${estimate.customer_name}`);
  doc.moveDown();

  items.forEach(i => {
    doc.text(`${i.item_name} | ${i.qty} x ${i.rate} = ₹${i.amount}`);
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${estimate.sub_total}`);
  doc.text(`Tax: ₹${estimate.tax}`);
  doc.text(`Total: ₹${estimate.final_total}`);
  doc.end();
});

/* ==============================
   GET LIST
================================ */
router.get('/', async (_, res) => {
  const [rows] = await db.query(
    `SELECT e.id, e.estimate_number, c.name customer_name,
            e.issue_date, e.final_total, e.status
     FROM estimates e
     JOIN contact c ON c.id=e.customer_id
     ORDER BY e.id DESC`
  );
  res.json(rows);
});

module.exports = router;
