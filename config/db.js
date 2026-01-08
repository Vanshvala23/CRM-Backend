const mysql=require('mysql2/promise');
const dotenv=require('dotenv');
dotenv.config();
const db= mysql.createConnection({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_NAME,
    port:process.env.DB_PORT,
    waitForConnections:true,
    connectionLimit:10,
    queueLimit:0
});

db.connect(err=>{
    if(err) throw err;
    console.log("MySQL Connected");
});

module.exports =  db;