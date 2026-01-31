const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const Contact = require("../models/COntact.js")
const upload = multer({ dest: "uploads/" });

/* ======================
   NAME HELPERS
====================== */
function splitName(name = "") {
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { first_name: null, last_name: null };

  const parts = name.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: null };

  return {
    first_name: parts.shift(),
    last_name: parts.join(" "),
  };
}

function joinName(first_name, last_name) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

/* ======================
   IMPORT CONTACTS FROM CSV
====================== */
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file required" });

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      const { first_name, last_name } = splitName(row.name);

      results.push({
        first_name,
        last_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        zipcode: row.zipcode,
        website: row.website,
        currency: row.currency,
        language: row.language,
        GST: row.GST,
      });
    })
    .on("end", async () => {
      try {
        await Contact.insertMany(results);
        fs.unlinkSync(req.file.path);
        res.json({ message: `Imported ${results.length} contacts successfully` });
      } catch (err) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: err.message });
      }
    });
});

/* ======================
   GET ALL CONTACTS
====================== */
router.get("/", async (req, res) => {
  try {
    const rows = await Contact.find({ deleted_at: null });
    const data = rows.map((c) => ({
      ...c.toObject(),
      name: joinName(c.first_name, c.last_name),
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   GET SINGLE CONTACT
====================== */
router.get("/:id", async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact || contact.deleted_at)
      return res.status(404).json({ message: "Not found" });

    const data = {
      ...contact.toObject(),
      name: joinName(contact.first_name, contact.last_name),
    };

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   CREATE CONTACT
====================== */
router.post("/", async (req, res) => {
  const { name, email, ...rest } = req.body;

  if (!name || !email)
    return res.status(400).json({ message: "Name & Email required" });

  const { first_name, last_name } = splitName(name);

  try {
    const newContact = await Contact.create({
      first_name,
      last_name,
      email,
      ...rest,
    });

    res.status(201).json({ message: "Contact Added", id: newContact._id });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Email already exists" });

    res.status(500).json({ message: err.message });
  }
});

/* ======================
   UPDATE CONTACT
====================== */
router.put("/:id", async (req, res) => {
  const { name, ...rest } = req.body;

  const updateData = { ...rest };

  if (name) {
    const { first_name, last_name } = splitName(name);
    updateData.first_name = first_name;
    updateData.last_name = last_name;
  }

  try {
    await Contact.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: "Contact Updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   SOFT DELETE CONTACT
====================== */
router.delete("/:id", async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, {
      deleted_at: new Date(),
    });

    res.json({ message: "Contact Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
