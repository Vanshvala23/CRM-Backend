const express = require('express');
const router = express.Router();
const Contact=require("../models/COntact");
const Estimate=require("../models/Estimate");
const PDFDocument = require('pdfkit');
async function generateEstimateNumber() {
  const last = await Estimate.findOne().sort({ createdAt: -1 });

  let next = 1;
  if (last && last.estimate_number) {
    next = parseInt(last.estimate_number.replace('EST-', '')) + 1;
  }

  return `EST-${String(next).padStart(6, '0')}`;
}

router.post('/', async (req, res) => {
  try {
    const {
      customer_id, bill_to, ship_to, issue_date, expiry_date, items,
      terms_and_conditions, tax_rate, discount_type, discount, currency
    } = req.body;

    if (!items?.length) return res.status(400).json({ message: 'Items required' });

    const estimate_number = await generateEstimateNumber();

    const { sub_total, tax_amount, final_total, items: calculatedItems } =
      calculateTotals(items, tax_rate || 18, discount || 0, discount_type || 'No discount');

    await Estimate.create({
      estimate_number,
      customer_id,
      bill_to,
      ship_to,
      issue_date,
      expiry_date,
      sub_total,
      tax_rate,
      tax_amount,
      final_total,
      terms_and_conditions,
      currency,
      discount_type,
      items: calculatedItems
    });

    res.status(201).json({ message: 'Estimate created', estimate_number });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Items required' });

    const { sub_total, tax_amount, final_total, items: calculatedItems } =
      calculateTotals(items);

    await Estimate.findByIdAndUpdate(req.params.id, {
      ...req.body,
      sub_total,
      tax_amount,
      final_total,
      items: calculatedItems
    });

    res.json({ message: 'Estimate updated' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/', async (req, res) => {
  try {
    const data = await Estimate.find()
      .populate('customer_id', 'first_name last_name')
      .sort({ createdAt: -1 });

    const formatted = data.map(e => ({
      id: e._id,
      estimate_number: e.estimate_number,
      customer_name: e.customer_id
        ? e.customer_id.first_name + ' ' + e.customer_id.last_name
        : '',
      issue_date: e.issue_date,
      final_total: e.final_total,
      status: e.status
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Estimate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Estimate not found' });

    res.json({ message: 'Estimate deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/:id/pdf', async (req, res) => {
  try {
    const estimate = await Estimate.findById(req.params.id)
      .populate('customer_id', 'first_name last_name');

    if (!estimate) return res.status(404).json({ message: 'Estimate not found' });

    const items = estimate.items;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const currency = estimate.currency || '₹';

    /* ================= HEADER ================= */
    doc
      .fontSize(22)
      .fillColor('#1f2937')
      .text('ESTIMATE', { align: 'center' });

    doc.moveDown(1.5);

    doc.fontSize(10).fillColor('#374151');
    doc.text(`Estimate #: ${estimate.estimate_number}`, 40, 100);
    doc.text(`Status: ${estimate.status || 'Draft'}`, 420, 100);
    doc.text(`Issue Date: ${estimate.issue_date?.toDateString() || '-'}`, 40, 115);
    doc.text(`Expiry Date: ${estimate.expiry_date?.toDateString() || '-'}`, 420, 115);

    doc.moveDown(2);

    /* ================= CUSTOMER ================= */
    doc.fontSize(11).fillColor('#111827');
    doc.text('Customer:', 40);
    doc.font('Helvetica-Bold').text(
      estimate.customer_id
        ? estimate.customer_id.first_name + ' ' + estimate.customer_id.last_name
        : '-'
    );
    doc.font('Helvetica');

    doc.moveDown();
    doc.text('Bill To:', 40);
    doc.font('Helvetica-Bold').text(estimate.bill_to || '-');
    doc.font('Helvetica');

    doc.moveDown();
    doc.text('Ship To:', 40);
    doc.font('Helvetica-Bold').text(estimate.ship_to || '-');
    doc.font('Helvetica');

    doc.moveDown(2);

    /* ================= ITEMS TABLE ================= */
    const tableTop = doc.y;
    const col = { item: 40, qty: 280, rate: 350, amount: 450 };

    // Header Row
    doc.rect(40, tableTop, 520, 22).fill('#1f2937');
    doc.fillColor('#ffffff').fontSize(11);
    doc.text('Item', col.item, tableTop + 6);
    doc.text('Qty', col.qty, tableTop + 6);
    doc.text('Rate', col.rate, tableTop + 6);
    doc.text('Amount', col.amount, tableTop + 6);

    let y = tableTop + 28;
    doc.fillColor('#000').fontSize(10);

    items.forEach(i => {
      doc.text(i.item_name || '-', col.item, y);
      doc.text(String(i.qty || 0), col.qty, y);
      doc.text(`${currency}${i.rate || 0}`, col.rate, y);
      doc.text(`${currency}${i.amount || 0}`, col.amount, y);
      y += 20;
    });

    /* ================= TOTALS ================= */
    const totalsY = y + 20;

    doc.text('Sub Total:', 350, totalsY);
    doc.text(`${currency}${estimate.sub_total || 0}`, 480, totalsY, { align: 'right' });

    doc.text('Tax:', 350, totalsY + 15);
    doc.text(`${currency}${estimate.tax_amount || 0}`, 480, totalsY + 15, { align: 'right' });

    doc
      .font('Helvetica-Bold')
      .text('Total:', 350, totalsY + 35)
      .text(`${currency}${estimate.final_total || 0}`, 480, totalsY + 35, { align: 'right' })
      .font('Helvetica');

    /* ================= TERMS ================= */
    if (estimate.terms_and_conditions) {
      doc.moveDown(3);
      doc.fontSize(11).text('Terms & Conditions:', { underline: true });
      doc.fontSize(10).text(estimate.terms_and_conditions);
    }

    /* ================= FOOTER ================= */
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text('This is a system generated estimate.', 40, 800, {
        align: 'center'
      });

    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;