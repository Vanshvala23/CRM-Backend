const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');

/* ==============================
   GENERATE CREDIT NOTE NUMBER
================================ */
async function generateCreditNoteNumber() {
    const [rows] = await db.query(
        `SELECT credit_note_number FROM credit_notes ORDER BY id DESC LIMIT 1`
    );
    let next = 1;
    if (rows.length && rows[0].credit_note_number) {
        next = parseInt(rows[0].credit_note_number.replace('CN-', '')) + 1;
    }
    return `CN-${String(next).padStart(6, '0')}`;
}

/* ==============================
   CREATE CREDIT NOTE
================================ */
router.post('/', async (req, res) => {
    const {
        customer_id, bill_to, ship_to, estimate_number,
        estimate_date, expiry_date, tags, currency,
        status, reference_number, sale_agent, discount_type,
        discount, adjustment, admin_note, client_note,
        terms_and_conditions, items
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ message: 'Items required' });

    try {
        const credit_note_number = await generateCreditNoteNumber();

        let sub_total = 0;
        let tax_amount = 0;

        items.forEach(i => {
            const amt = i.qty * i.rate;
            sub_total += amt;
            tax_amount += amt * (i.tax || 0) / 100 * amt;
            i.amount = amt + ((i.tax || 0) / 100 * amt);
        });

        let total = sub_total + tax_amount;

        if (discount_type === 'Before tax' && discount) total = (sub_total - discount) + tax_amount;
        else if (discount_type === 'After tax' && discount) total -= discount;

        total += adjustment || 0;

        const [result] = await db.query(
            `INSERT INTO credit_notes
            (credit_note_number, customer_id, bill_to, ship_to, estimate_number,
             estimate_date, expiry_date, tags, currency, status, reference_number,
             sale_agent, discount_type, discount, adjustment, sub_total, tax_rate,
             tax_amount, total, admin_note, client_note, terms_and_conditions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                credit_note_number, customer_id, bill_to, ship_to, estimate_number,
                estimate_date, expiry_date, tags, currency || '₹', status || 'Draft', reference_number,
                sale_agent, discount_type || 'No discount', discount || 0, adjustment || 0, sub_total, 18,
                tax_amount, total, admin_note, client_note, terms_and_conditions
            ]
        );

        const credit_note_id = result.insertId;

        for (const i of items) {
            await db.query(
                `INSERT INTO credit_note_items
                (credit_note_id, item_name, description, qty, unit, rate, tax, amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [credit_note_id, i.item_name, i.description, i.qty, i.unit, i.rate, i.tax || 0, i.amount]
            );
        }

        res.status(201).json({ message: 'Credit Note created', credit_note_number });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==============================
   GET ALL CREDIT NOTES
================================ */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT cn.id, cn.credit_note_number, CONCAT(c.first_name,' ',c.last_name) AS customer_name,
                    cn.estimate_number, cn.estimate_date, cn.total, cn.status
             FROM credit_notes cn
             JOIN contact c ON c.id = cn.customer_id
             ORDER BY cn.id DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==============================
   GET SINGLE CREDIT NOTE + ITEMS
================================ */
router.get('/:id', async (req, res) => {
    try {
        const [[cn]] = await db.query(
            `SELECT cn.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
             FROM credit_notes cn
             JOIN contact c ON c.id = cn.customer_id
             WHERE cn.id=?`, [req.params.id]
        );

        const [items] = await db.query(`SELECT * FROM credit_note_items WHERE credit_note_id=?`, [req.params.id]);

        res.json({ credit_note: cn, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==============================
   DELETE CREDIT NOTE
================================ */
router.delete('/:id', async (req, res) => {
    try {
        await db.query(`DELETE FROM credit_note_items WHERE credit_note_id=?`, [req.params.id]);
        const [result] = await db.query(`DELETE FROM credit_notes WHERE id=?`, [req.params.id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Credit Note not found' });
        res.json({ message: 'Credit Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ==============================
   PDF GENERATION
================================ */
router.get('/:id/pdf', async (req, res) => {
    try {
        const [[cn]] = await db.query(
            `SELECT cn.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
             FROM credit_notes cn
             JOIN contact c ON c.id = cn.customer_id
             WHERE cn.id=?`, [req.params.id]
        );

        const [items] = await db.query(`SELECT * FROM credit_note_items WHERE credit_note_id=?`, [req.params.id]);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(22).text('CREDIT NOTE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Credit Note #: ${cn.credit_note_number}`);
        doc.text(`Customer: ${cn.customer_name}`);
        doc.text(`Bill To: ${cn.bill_to}`);
        doc.text(`Ship To: ${cn.ship_to || '-'}`);
        doc.text(`Estimate #: ${cn.estimate_number || '-'}`);
        doc.text(`Estimate Date: ${cn.estimate_date}`);
        doc.text(`Expiry Date: ${cn.expiry_date}`);
        doc.text(`Currency: ${cn.currency}`);
        doc.text(`Status: ${cn.status}`);
        doc.moveDown();

        doc.fontSize(14).text('Items:', { underline: true });
        items.forEach(i => {
            doc.fontSize(12).text(
                `${i.item_name} | ${i.description || ''} | Qty: ${i.qty} ${i.unit || ''} x ${cn.currency}${i.rate} | Tax: ${i.tax}% | Amount: ${cn.currency}${i.amount}`
            );
        });

        doc.moveDown();
        doc.text(`Sub Total: ${cn.currency}${cn.sub_total}`);
        doc.text(`Discount: ${cn.discount || 0}`);
        doc.text(`Adjustment: ${cn.adjustment || 0}`);
        doc.text(`Tax: ${cn.tax_amount}`);
        doc.text(`Total: ${cn.currency}${cn.total}`);
        doc.moveDown();
        if (cn.client_note) doc.text(`Client Note: ${cn.client_note}`);
        if (cn.admin_note) doc.text(`Admin Note: ${cn.admin_note}`);
        if (cn.terms_and_conditions) doc.text(`Terms & Conditions: ${cn.terms_and_conditions}`);

        doc.end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
