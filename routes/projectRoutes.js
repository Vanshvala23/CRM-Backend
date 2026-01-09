const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ===============================
   CREATE PROJECT + MEMBERS
================================ */
router.post("/", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      name,
      customer_id,
      bill_type,
      status,
      rate_per_hour,
      estimated_hour,
      start_date,
      end_date,
      tags,
      description,
      members // array of user IDs
    } = req.body;

    await connection.beginTransaction();

    const [projectResult] = await connection.query(
      `INSERT INTO projects
      (name, customer_id, bill_type, status, rate_per_hour, estimated_hour, start_date, end_date, tags, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        customer_id || null,
        bill_type || "Project hours",
        status || "Not started",
        rate_per_hour || null,
        estimated_hour || null,
        start_date || null,
        end_date || null,
        tags || null,
        description || null
      ]
    );

    const projectId = projectResult.insertId;

    if (Array.isArray(members) && members.length > 0) {
      const values = members.map(userId => [projectId, userId]);
      await connection.query(
        `INSERT INTO project_members (project_id, user_id) VALUES ?`,
        [values]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project_id: projectId
    });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
});

/* ===============================
   GET ALL PROJECTS
================================ */
router.get("/", async (req, res) => {
  try {
    const [projects] = await db.query(`
      SELECT 
        p.*,
        CONCAT(c.first_name,' ',c.last_name) AS customer_name,
        GROUP_CONCAT(u.name) AS members
      FROM projects p
      LEFT JOIN contacts c ON c.id = p.customer_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN users u ON u.id = pm.user_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   GET SINGLE PROJECT
================================ */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.*,
        CONCAT(c.first_name,' ',c.last_name) AS customer_name,
        GROUP_CONCAT(u.id) AS member_ids,
        GROUP_CONCAT(u.name) AS member_names
      FROM projects p
      LEFT JOIN contacts c ON c.id = p.customer_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN users u ON u.id = pm.user_id
      WHERE p.id=?
      GROUP BY p.id
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   UPDATE PROJECT + MEMBERS
================================ */
router.put("/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      name,
      customer_id,
      bill_type,
      status,
      rate_per_hour,
      estimated_hour,
      start_date,
      end_date,
      tags,
      description,
      members // array of user IDs
    } = req.body;

    await connection.beginTransaction();

    await connection.query(
      `UPDATE projects SET
        name=?,
        customer_id=?,
        bill_type=?,
        status=?,
        rate_per_hour=?,
        estimated_hour=?,
        start_date=?,
        end_date=?,
        tags=?,
        description=?
      WHERE id=?`,
      [
        name,
        customer_id || null,
        bill_type,
        status,
        rate_per_hour,
        estimated_hour,
        start_date,
        end_date,
        tags,
        description,
        req.params.id
      ]
    );

    // reset members
    await connection.query(
      `DELETE FROM project_members WHERE project_id=?`,
      [req.params.id]
    );

    if (Array.isArray(members) && members.length > 0) {
      const values = members.map(userId => [req.params.id, userId]);
      await connection.query(
        `INSERT INTO project_members (project_id, user_id) VALUES ?`,
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Project updated successfully" });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
});

/* ===============================
   DELETE PROJECT
================================ */
router.delete("/:id", async (req, res) => {
  try {
    await db.query(`DELETE FROM projects WHERE id=?`, [req.params.id]);
    await db.query('alter table projects auto_increment=1');
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
