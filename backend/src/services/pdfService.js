const PDFDocument = require('pdfkit');

const money = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

// Streams a thermal-style receipt (80mm wide) straight to the HTTP response.
// Kept narrow so shopkeepers can print it on the cheap roll printers that are
// standard at Pakistani counters, while still being readable as an A4 PDF.
const buildReceiptPDF = (sale, shop, res) => {
  const doc = new PDFDocument({ size: [226, 700], margin: 12 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${sale.receiptNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(14).text(shop?.name || 'RetailPro', { align: 'center' });
  if (shop?.address) doc.fontSize(7).text(shop.address, { align: 'center' });
  if (shop?.phone) doc.fontSize(7).text(`Ph: ${shop.phone}`, { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(7).text(`Receipt: ${sale.receiptNumber}`);
  doc.text(`Date: ${new Date(sale.createdAt).toLocaleString('en-PK')}`);
  doc.text(`Customer: ${sale.customerId?.name || 'Walk-in'}`);
  doc.text(`Payment: ${sale.paymentMethod}`);

  doc.moveDown(0.4);
  doc.text('-'.repeat(46));
  doc.text('Item                 Qty    Price    Total');
  doc.text('-'.repeat(46));

  sale.items.forEach((item) => {
    const name = item.name.length > 20 ? `${item.name.slice(0, 19)}.` : item.name.padEnd(20);
    const qty = String(item.quantity).padStart(3);
    const price = String(item.unitPrice).padStart(8);
    const total = String(item.subtotal).padStart(9);
    doc.text(`${name}${qty}${price}${total}`);
  });

  doc.text('-'.repeat(46));
  doc.moveDown(0.3);
  doc.fontSize(8);
  doc.text(`Subtotal: ${money(sale.subtotal)}`, { align: 'right' });
  if (sale.discount > 0) doc.text(`Discount: -${money(sale.discount)}`, { align: 'right' });
  if (sale.tax > 0) doc.text(`Tax: ${money(sale.tax)}`, { align: 'right' });
  doc.fontSize(11).text(`TOTAL: ${money(sale.totalAmount)}`, { align: 'right' });

  doc.moveDown(0.8);
  // Note: pdfkit's built-in fonts are Latin-only. To print an Urdu thank-you
  // line here, register a Nastaliq TTF via doc.registerFont() first.
  doc.fontSize(7).text('Thank you for your business!', { align: 'center' });

  doc.end();
};

module.exports = { buildReceiptPDF };
