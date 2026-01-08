const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');

// ==============================
// GENERATE CREDIT NOTE NUMBER
// ==============================
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

// ==============================
// CREATE CREDIT NOTE
// ==============================
router.post('/', async (req, res) => {
    const {
        customer_id, bill_to, ship_to, estimate_number,
        estimate_date, expiry_date, tags, currency,
        status, reference_number, sale_agent, discount_type,
        discount, adjustment, admin_note, client_note,
        terms_and_conditions, items
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ message: 'Items required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const credit_note_number = await generateCreditNoteNumber();

        let sub_total = 0;
        let tax_amount = 0;

        items.forEach(i => {
            const amt = Number(i.qty) * Number(i.rate);
            const taxRate = Number(i.tax || 18);
            sub_total += amt;
            tax_amount += amt * (taxRate / 100);
            i.amount = amt + (amt * (taxRate / 100));
        });

        let total = sub_total + tax_amount;

        if (discount_type === 'Before tax' && discount) total = (sub_total - discount) + tax_amount;
        else if (discount_type === 'After tax' && discount) total -= discount;

        total += Number(adjustment || 0);

        const [result] = await conn.query(
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

        const itemValues = items.map(i => [
            credit_note_id, i.item_name, i.description, i.qty, i.unit, i.rate, i.tax || 18, i.amount
        ]);

        await conn.query(
            `INSERT INTO credit_note_items
             (credit_note_id, item_name, description, qty, unit, rate, tax, amount)
             VALUES ?`,
            [itemValues]
        );

        await conn.commit();
        res.status(201).json({ message: 'Credit Note created', credit_note_number });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ==============================
// GET ALL CREDIT NOTES
// ==============================
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

// ==============================
// GET SINGLE CREDIT NOTE + ITEMS
// ==============================
router.get('/:id', async (req, res) => {
    try {
        const [[cn]] = await db.query(
            `SELECT cn.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
             FROM credit_notes cn
             JOIN contact c ON c.id = cn.customer_id
             WHERE cn.id=?`, [req.params.id]
        );

        if (!cn) return res.status(404).json({ message: 'Credit Note not found' });

        const [items] = await db.query(`SELECT * FROM credit_note_items WHERE credit_note_id=?`, [req.params.id]);

        res.json({ credit_note: cn, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// DELETE CREDIT NOTE (WITH ITEMS)
// ==============================
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`DELETE FROM credit_note_items WHERE credit_note_id=?`, [req.params.id]);
        const [result] = await conn.query(`DELETE FROM credit_notes WHERE id=?`, [req.params.id]);

        if (!result.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ message: 'Credit Note not found' });
        }

        await conn.commit();
        res.json({ message: 'Credit Note deleted successfully' });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});
// ==============================
// PDF GENERATION (IMPROVED UI)
// ==============================
router.get('/:id/pdf', async (req, res) => {
    try {
        const [[cn]] = await db.query(
            `SELECT cn.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
             FROM credit_notes cn
             JOIN contact c ON c.id = cn.customer_id
             WHERE cn.id=?`, [req.params.id]
        );

        if (!cn) return res.status(404).json({ message: 'Credit Note not found' });

        const [items] = await db.query(
            `SELECT * FROM credit_note_items WHERE credit_note_id=?`,
            [req.params.id]
        );

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        const currency = cn.currency || '₹';

        /* ================= HEADER ================= */
        doc
            .fontSize(22)
            .fillColor('#1f2937')
            .text('CREDIT NOTE', { align: 'center' });

        doc.moveDown(1.5);

        doc
            .fontSize(10)
            .fillColor('#374151');

        doc.text(`Credit Note #: ${cn.credit_note_number}`, 40, 100);
        doc.text(`Status: ${cn.status}`, 400, 100);

        doc.text(`Estimate #: ${cn.estimate_number || '-'}`, 40, 115);
        doc.text(`Estimate Date: ${cn.estimate_date}`, 400, 115);

        doc.moveDown(2);

        /* ================= CUSTOMER INFO ================= */
        doc
            .fontSize(11)
            .fillColor('#111827')
            .text('Bill To:', 40)
            .font('Helvetica-Bold')
            .text(cn.customer_name)
            .font('Helvetica')
            .text(cn.bill_to || '-');

        doc
            .fontSize(11)
            .fillColor('#111827')
            .text('Ship To:', 320, 160)
            .font('Helvetica-Bold')
            .text(cn.ship_to || '-', 320)
            .font('Helvetica');

        doc.moveDown(2);

        /* ================= ITEMS TABLE ================= */
        const tableTop = doc.y;
        const col = {
            item: 40,
            qty: 260,
            rate: 320,
            tax: 390,
            amount: 460
        };

        doc
            .fontSize(11)
            .fillColor('#ffffff')
            .rect(40, tableTop, 520, 20)
            .fill('#1f2937');

        doc
            .fillColor('#ffffff')
            .text('Item', col.item, tableTop + 5)
            .text('Qty', col.qty, tableTop + 5)
            .text('Rate', col.rate, tableTop + 5)
            .text('Tax', col.tax, tableTop + 5)
            .text('Amount', col.amount, tableTop + 5);

        let y = tableTop + 25;
        doc.fillColor('#000');

        items.forEach((i, index) => {
            doc
                .fontSize(10)
                .text(i.item_name, col.item, y)
                .text(i.qty, col.qty, y)
                .text(`${currency}${i.rate}`, col.rate, y)
                .text(`${i.tax}%`, col.tax, y)
                .text(`${currency}${i.amount}`, col.amount, y);

            y += 20;
        });

        doc.moveDown(3);

        /* ================= TOTALS ================= */
        const totalsY = y + 10;
        doc
            .fontSize(11)
            .text('Sub Total:', 360, totalsY)
            .text(`${currency}${cn.sub_total}`, 460, totalsY, { align: 'right' });

        doc.text('Discount:', 360, totalsY + 15);
        doc.text(`${currency}${cn.discount || 0}`, 460, totalsY + 15, { align: 'right' });

        doc.text('Adjustment:', 360, totalsY + 30);
        doc.text(`${currency}${cn.adjustment || 0}`, 460, totalsY + 30, { align: 'right' });

        doc.text('Tax:', 360, totalsY + 45);
        doc.text(`${currency}${cn.tax_amount}`, 460, totalsY + 45, { align: 'right' });

        doc
            .font('Helvetica-Bold')
            .text('Total:', 360, totalsY + 65)
            .text(`${currency}${cn.total}`, 460, totalsY + 65, { align: 'right' })
            .font('Helvetica');

        doc.moveDown(4);

        /* ================= NOTES ================= */
        if (cn.client_note) {
            doc.fontSize(11).text('Client Note:', { underline: true });
            doc.fontSize(10).text(cn.client_note);
            doc.moveDown();
        }

        if (cn.terms_and_conditions) {
            doc.fontSize(11).text('Terms & Conditions:', { underline: true });
            doc.fontSize(10).text(cn.terms_and_conditions);
        }

        /* ================= FOOTER ================= */
        doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text('Thank you for your business!', 40, 800, { align: 'center' });

        doc.end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
