const express = require('express');
const cors=require('cors');
const app=express();
const dotenv=require('dotenv');
dotenv.config();
const PORT =process.env.PORT||5000;

app.use(cors());
app.use(express.json());

app.use("/api/contact",require('./routes/ContactRoutes'));

app.use("/api/lead",require('./routes/LeadsRoutes'));

app.use("/api/invoice",require('./routes/InovoiceRoutes'));

app.listen(PORT,()=>
{
    console.log(`Server is stated at port http://localhost:${PORT}`);
})