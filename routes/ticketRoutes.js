const express = require('express');
const router = express.Router();
const db=require('../config/db');


/*==> ticket creation<==*/

router.post("/",async(req,res)=>
{
    try {
        const{ticket_type,subject,contact_id, name, email, department_id, service_id,assigned_to,priority,cc}=req.body;

        if(!ticket_type || !subject || !department_id || !service_id || !assigned_to){
            return res.status(400).json({message:"Required fields missing"});
        }
        let finalContactId = null;
    let finalName = null;
    let finalEmail = null;

    if (ticket_type === "with_contact") {
      if (!contact_id) {
        return res.status(400).json({ message: "Contact is required" });
      }
      finalContactId = contact_id;
    } else {
      if (!name || !email) {
        return res.status(400).json({ message: "Name and Email are required" });
      }
      finalName = name;
      finalEmail = email;
    }

    const[result]=await db.query(`INSERT INTO tickets
      (ticket_type, subject, contact_id, name, email, department_id, service_id, assigned_to, priority, cc)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,[
        ticket_type,
        subject,
        finalContactId,
        finalName,
        finalEmail,
        department_id,
        service_id,
        assigned_to,
        priority || "medium",
        cc || null
      ]);
      res.status(200).json({
        message: "Ticket created successfully",
      ticket_id: result.insertId
      });
    } catch (error) {
        console.error(error)
        res.status(500).json({message:"Server error"})
    }
});
router.get("/", async (req, res) => {
  try {
    const [tickets] = await db.query(`
      SELECT 
        t.*,
        CONCAT(c.first_name,' ',c.last_name) AS contact_name,
        c.email AS contact_email,
        d.name AS department_name,
        s.name AS service_name,
        u.name AS assigned_user
      FROM tickets t
      LEFT JOIN contact c ON c.id = t.contact_id
      JOIN departments d ON d.id = t.department_id
      JOIN services s ON s.id = t.service_id
      JOIN users u ON u.id = t.assigned_to
      ORDER BY t.created_at DESC
    `);

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM tickets WHERE id=?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
      subject,
      department_id,
      service_id,
      assigned_to,
      priority,
      status,
      cc
    } = req.body;

    await db.query(
      `UPDATE tickets SET
        subject=?,
        department_id=?,
        service_id=?,
        assigned_to=?,
        priority=?,
        status=?,
        cc=?
      WHERE id=?`,
      [
        subject,
        department_id,
        service_id,
        assigned_to,
        priority,
        status,
        cc,
        req.params.id
      ]
    );

    res.json({ message: "Ticket updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query(`DELETE FROM tickets WHERE id=?`, [req.params.id]);
    res.json({ message: "Ticket deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
