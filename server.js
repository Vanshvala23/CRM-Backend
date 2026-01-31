const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('../config/db');

const app = express();

// Connect DB (important: cache connection in db.js)
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/contact", require('../routes/ContactRoutes'));
app.use("/api/lead", require('../routes/LeadsRoutes'));
app.use("/api/invoice", require('../routes/InovoiceRoutes'));
app.use("/api/proposal", require('../routes/ProposalRoutes'));
app.use("/api/estimate", require("../routes/EstimatationRoutes"));
app.use("/api/creditnote", require("../routes/creditNoteRoutes"));
app.use("/api/item", require('../routes/itemsRoutes'));
app.use("/api/group", require("../routes/groupRoutes"));
app.use("/api/tasks", require("../routes/tasksRoutes"));
app.use("/api/users", require('../routes/userRoutes'));
app.use("/api/projects", require('../routes/projectRoutes'));
app.use("/api/tickets", require('../routes/ticketRoutes'));
app.use("/api/departments", require('../routes/departmentsRoutes'));
app.use("/api/services", require('../routes/servicesRoutes'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server Error", error: err.message });
});

// EXPORT instead of listen
module.exports = app;
