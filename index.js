const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

/* ================= DB CONNECT ================= */
(async () => {
  try {
    await connectDB();
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("DB Connection Failed:", err.message);
  }
})();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.status(200).send("API Running");
});

/* ================= STATIC UPLOADS (SAFE) ================= */
const uploadsPath = path.join(__dirname, "../uploads");
if (fs.existsSync(uploadsPath)) {
  app.use("/uploads", express.static(uploadsPath));
}

/* ================= ROUTES ================= */
// ⚠️ Ensure file names EXACTLY match on disk (Linux is case-sensitive)

app.use("/api/contact", require("./routes/ContactRoutes"));
app.use("/api/lead", require("./routes/LeadsRoutes"));
app.use("/api/invoice", require("./routes/InvoiceRoutes"));      // fixed spelling
app.use("/api/proposal", require("./routes/ProposalRoutes"));
app.use("/api/estimate", require("./routes/EstimationRoutes"));  // fixed spelling
app.use("/api/creditnote", require("./routes/creditNoteRoutes"));
app.use("/api/item", require("./routes/itemsRoutes"));
app.use("/api/group", require("./routes/groupRoutes"));
app.use("/api/tasks", require("./routes/tasksRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/departments", require("./routes/departmentsRoutes"));
app.use("/api/services", require("./routes/servicesRoutes"));

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).json({ message: "Route Not Found" });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("ERROR:", err.stack);
  res.status(500).json({
    message: "Server Error",
    error: err.message || "Unknown Error",
  });
});

/* ================= EXPORT (NO LISTEN) ================= */
module.exports = app;
