const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');

// ==============================
// GENERATE ESTIMATE NUMBER
// ==============================
async function generateEstimateNumber() {
    const [rows] = await db.query(
        `SELECT estimate_number FROM estimates ORDER BY id DESC LIMIT 1`
    );

    let next = 1;
    if (rows.length && rows[0].estimate_number) {
        next = parseInt(rows[0].estimate_number.replace('EST-', '')) + 1;
    }

    return `EST-${String(next).padStart(6, '0')}`;
}

// ==============================
// CALCULATE ESTIMATE TOTALS
// ==============================
function calculateTotals(items, tax_rate = 18, discount = 0, discount_type = 'No discount') {
    let sub_total = 0;
    let tax_amount = 0;

    items.forEach(item => {
        const amount = Number(item.qty) * Number(item.rate);
        sub_total += amount;
        tax_amount += amount * (Number(item.tax || tax_rate) / 100);
        item.amount = amount;
    });

    let final_total = sub_total + tax_amount;

    if (discount_type === 'Before tax') {
        final_total = (sub_total - discount) + tax_amount;
    } else if (discount_type === 'After tax') {
        final_total -= discount;
    }

    return { sub_total, tax_amount, final_total, items };
}

// ==============================
// CREATE ESTIMATE
// ==============================
router.post('/', async (req, res) => {
    const {
        customer_id, bill_to, ship_to, issue_date, expiry_date, items,
        terms_and_conditions, tax_rate, discount_type, discount, currency
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ message: 'Items required' });

    const estimate_number = await generateEstimateNumber();
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const { sub_total, tax_amount, final_total, items: calculatedItems } =
            calculateTotals(items, tax_rate || 18, discount || 0, discount_type || 'No discount');

        const [result] = await conn.query(
            `INSERT INTO estimates 
            (estimate_number, customer_id, bill_to, ship_to, issue_date, expiry_date, sub_total, tax_rate, tax_amount, final_total, terms_and_conditions, status, currency, discount_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)`,
            [estimate_number, customer_id, bill_to, ship_to, issue_date, expiry_date, sub_total, tax_rate || 18, tax_amount, final_total, terms_and_conditions, currency || '₹', discount_type || 'No discount']
        );

        const estimate_id = result.insertId;

        const values = calculatedItems.map(i => [
            estimate_id,
            i.item_name,
            i.qty,
            i.rate,
            i.tax || tax_rate || 18,
            i.amount
        ]);

        await conn.query(
            `INSERT INTO estimate_items (estimate_id, item_name, qty, rate, tax, amount) VALUES ?`,
            [values]
        );

        await conn.commit();
        res.status(201).json({ message: 'Estimate created', estimate_number });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ==============================
// UPDATE ESTIMATE
// ==============================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        bill_to, ship_to, issue_date, expiry_date, items,
        terms_and_conditions, tax_rate, discount_type, discount, currency
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ message: 'Items required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { sub_total, tax_amount, final_total, items: calculatedItems } =
            calculateTotals(items, tax_rate || 18, discount || 0, discount_type || 'No discount');

        await conn.query(
            `UPDATE estimates SET bill_to=?, ship_to=?, issue_date=?, expiry_date=?, sub_total=?, tax_rate=?, tax_amount=?, final_total=?, terms_and_conditions=?, currency=?, discount_type=? WHERE id=?`,
            [bill_to, ship_to, issue_date, expiry_date, sub_total, tax_rate || 18, tax_amount, final_total, terms_and_conditions, currency || '₹', discount_type || 'No discount', id]
        );

        // Delete old items
        await conn.query(`DELETE FROM estimate_items WHERE estimate_id=?`, [id]);

        const values = calculatedItems.map(i => [
            id,
            i.item_name,
            i.qty,
            i.rate,
            i.tax || tax_rate || 18,
            i.amount
        ]);

        await conn.query(
            `INSERT INTO estimate_items (estimate_id, item_name, qty, rate, tax, amount) VALUES ?`,
            [values]
        );

        await conn.commit();
        res.json({ message: 'Estimate updated' });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ==============================
// GET ESTIMATES LIST
// ==============================
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.id, e.estimate_number, CONCAT(c.first_name,' ',c.last_name) AS customer_name, e.issue_date, e.final_total, e.status
             FROM estimates e
             JOIN contact c ON c.id = e.customer_id
             ORDER BY e.id DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// GENERATE PDF
// ==============================
router.get('/:id/pdf', async (req, res) => {
    try {
        const [[estimate]] = await db.query(
            `SELECT e.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name FROM estimates e
             JOIN contact c ON c.id = e.customer_id WHERE e.id=?`,
            [req.params.id]
        );

        const [items] = await db.query(`SELECT * FROM estimate_items WHERE estimate_id=?`, [req.params.id]);

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        const currency = estimate.currency || '₹';

        doc.fontSize(20).text('ESTIMATE', { align: 'center' });
        doc.moveDown();
        doc.text(`Estimate No: ${estimate.estimate_number}`);
        doc.text(`Customer: ${estimate.customer_name}`);
        doc.moveDown();

        items.forEach(i => {
            doc.text(`${i.item_name} | ${i.qty} x ${i.rate} = ${currency}${i.amount}`);
        });

        doc.moveDown();
        doc.text(`Subtotal: ${currency}${estimate.sub_total}`);
        doc.text(`Tax: ${currency}${estimate.tax_amount}`);
        doc.text(`Total: ${currency}${estimate.final_total}`);
        doc.end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// DELETE ESTIMATE
// ==============================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Delete items first
        await conn.query(`DELETE FROM estimate_items WHERE estimate_id=?`, [id]);

        // Delete estimate
        const [result] = await conn.query(`DELETE FROM estimates WHERE id=?`, [id]);
        if (!result.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ message: 'Estimate not found' });
        }

        await conn.commit();
        res.json({ message: 'Estimate deleted successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
