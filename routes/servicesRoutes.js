const express = require("express");
const router = express.Router();
const Service = require("../models/Service");

// Get all services
router.get("/", async (req, res) => {
  try {
    const services = await Service.find().sort({ name: 1 }); // sorted alphabetically
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create a service
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const service = new Service({ name });
    await service.save();

    res.status(201).json({ message: "Service created", id: service._id });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
