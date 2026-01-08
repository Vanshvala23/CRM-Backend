const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==============================
// GET ALL MASTER ITEMS
// ==============================
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM items ORDER BY name ASC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// GET SINGLE ITEM
// ==============================
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM items WHERE id=?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ message: 'Item not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// CREATE MASTER ITEM
// ==============================
router.post('/', async (req, res) => {
    try {
        const { name, description, long_description, rate, tax1, tax2, unit, item_group } = req.body;
        const [result] = await db.query(
            `INSERT INTO items (name, description, long_description, rate, tax1, tax2, unit, item_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, long_description, rate || 0, tax1 || 0, tax2 || 0, unit, item_group]
        );
        res.status(201).json({ message: 'Item added', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// UPDATE MASTER ITEM
// ==============================
router.put('/:id', async (req, res) => {
    try {
        const fields = req.body;
        await db.query(`UPDATE items SET ? WHERE id=?`, [fields, req.params.id]);
        res.json({ message: 'Item updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// DELETE MASTER ITEM
// ==============================
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.query(`DELETE FROM items WHERE id=?`, [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Item not found' });
        res.json({ message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
