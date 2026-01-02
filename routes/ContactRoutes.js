const express = require('express');
const db=require('../config/db');
const router=express.Router();

//get all contacts
router.get("/",(req,res)=>
{
    db.query("Select * from contact",(err,result)=>{
        if(err)return res.status(500).send(err);
        res.json(result);
    })
});

router.post("/",(req,res)=>
{
    let{
        name,
    email,
    phone,
    address,
    city,
    state,
    country,
    zipcode,
    source,
    industry,
    currency,
    language,
    DOB,
    jobTitle
    }=req.body;

    if(DOB) DOB=new Date(DOB).toISOString().split("T")[0]
    const sql=`INSERT INTO contact 
    (name,email,phone,address,city,state,country,zipcode,source,industry,currency,language,DOB,jobTitle)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    db.query(
    sql,
    [
      name,
      email,
      phone,
      address,
      city,
      state,
      country,
      zipcode,
      source,
      industry,
      currency,
      language,
      DOB,
      jobTitle
    ],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ message: "Contact Added", id: result.insertId });
    }
    );
});

router.put("/:id",(req,res)=>
{
   const{
        name,
    email,
    phone,
    address,
    city,
    state,
    country,
    zipcode,
    source,
    industry,
    currency,
    language,
    DOB,
    jobTitle
    }=req.body;

    const sql = `
    UPDATE contact SET
    name=?, email=?, phone=?, address=?, city=?, state=?, country=?, zipcode=?,
    source=?, industry=?, currency=?, language=?, DOB=?,jobTitle=?
    WHERE id=?
  `;

    db.query(
    sql,
    [
      name,
      email,
      phone,
      address,
      city,
      state,
      country,
      zipcode,
      source,
      industry,
      currency,
      language,
      DOB,
      jobTitle,
      req.params.id
    ],
    (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: "Contact Updated" });
    }
  );
});
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM contact WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: "Contact Deleted" });
  });
});

module.exports = router;