const express = require('express');
const cors = require('cors');
const app = express();
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (optional)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
//customer routes
app.use("/api/contact", require('./routes/ContactRoutes'));
app.use("/api/lead", require('./routes/LeadsRoutes'));

//financial routes
app.use("/api/invoice", require('./routes/InovoiceRoutes'));
app.use("/api/proposal", require('./routes/ProposalRoutes'));
app.use("/api/estimate",require("./routes/EstimatationRoutes"));
app.use("/api/creditnote",require("./routes/creditNoteRoutes"));
app.use("/api/item",require('./routes/itemsRoutes'));

app.use("/api/group", require("./routes/groupRoutes"));


//tasks, support and ticket routes
app.use("/api/tasks", require("./routes/tasksRoutes"));
app.use("/api/users",require("./routes/userRoutes"));
app.use('/api/projects',require('./routes/projectRoutes'));

app.use("/api/tickets",require('./routes/ticketRoutes'));
app.use("/api/departments",require('./routes/departmentsRoutes'));
app.use("/api/services",require('./routes/servicesRoutes'));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Server Error", error: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is started at http://localhost:${PORT}`);
});
