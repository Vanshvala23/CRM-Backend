const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const Customer = require("../models/COntact"); // create this for converted leads

/* =========================
   NAME HELPERS
========================= */
function splitName(name = "") {
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { first_name: null, last_name: null };
  const parts = name.split(" ");
  return parts.length === 1
    ? { first_name: parts[0], last_name: null }
    : { first_name: parts.shift(), last_name: parts.join(" ") };
}

function joinName(first_name, last_name) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

/* =========================
   GET ALL LEADS
========================= */
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find({ deleted_at: null }).sort({ createdAt: -1 });
    const formatted = leads.map(l => ({ ...l.toObject(), name: joinName(l.first_name, l.last_name) }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE LEAD
========================= */
router.get("/:id", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead || lead.deleted_at) return res.status(404).json({ message: "Lead not found" });

    res.json({ ...lead.toObject(), name: joinName(lead.first_name, lead.last_name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CREATE LEAD
========================= */
router.post("/", async (req, res) => {
  try {
    const { name, ...rest } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const { first_name, last_name } = splitName(name);

    const lead = await Lead.create({
      first_name,
      last_name,
      status: rest.status || "New",
      source: rest.source || null,
      assigned_to: rest.assigned_to || null,
      tags: rest.tags || [],
      position: rest.position || null,
      email: rest.email || null,
      website: rest.website || null,
      phone: rest.phone || null,
      lead_value: rest.lead_value || 0,
      company: rest.company || null,
      description: rest.description || null,
      address: rest.address || null,
      city: rest.city || null,
      state: rest.state || null,
      country: rest.country || null,
      zipcode: rest.zipcode || null,
      default_language: rest.default_language || "System Default",
      is_public: rest.is_public || false,
      contacted_today: rest.contacted_today || false,
      currency: rest.currency || "USD"
    });

    res.status(201).json({ message: "Lead created", id: lead._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE LEAD
========================= */
router.put("/:id", async (req, res) => {
  try {
    const updates = {};

    if (req.body.name) {
      const { first_name, last_name } = splitName(req.body.name);
      updates.first_name = first_name;
      updates.last_name = last_name;
    }

    const allowed = [
      "status","source","assigned_to","tags","position","email","website","phone",
      "lead_value","company","description","address","city","state","country","zipcode",
      "default_language","is_public","contacted_today","currency"
    ];

    allowed.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: "No fields to update" });

    updates.updatedAt = new Date();

    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    res.json({ message: "Lead updated" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE LEAD (Soft Delete)
========================= */
router.delete("/:id", async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    res.json({ message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CONVERT LEAD TO CUSTOMER
========================= */
router.post("/:id/convert", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead || lead.deleted_at) return res.status(404).json({ message: "Lead not found" });

    // Create a customer document (assumes you have a Customer model)
    const customerData = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      position: lead.position,
      email: lead.email,
      company: lead.company,
      phone: lead.phone,
      website: lead.website,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      country: lead.country,
      zipcode: lead.zipcode,
      lead_id: lead._id
    };

    const customer = await Customer.create(customerData);

    lead.converted_to_customer = true;
    await lead.save();

    res.json({ message: "Lead converted to customer", customer_id: customer._id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
