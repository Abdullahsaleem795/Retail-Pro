const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const generateReceiptNumber = () => `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const getSales = asyncHandler(async (req, res) => {
  const { from, to, customerId, page = 1, limit = 20 } = req.query;
  const query = { shopId: req.shopId };
  if (customerId) query.customerId = customerId;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [sales, total] = await Promise.all([
    Sale.find(query).populate('customerId', 'name phone').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Sale.countDocuments(query),
  ]);

  res.json({ success: true, count: sales.length, total, page: Number(page), data: sales });
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId }).populate('customerId', 'name phone');
  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }
  res.json({ success: true, data: sale });
});

// The core POS transaction: validates stock for every line item, decrements it
// atomically, snapshots prices onto the sale (so later price edits don't rewrite
// history), and updates customer credit balance for 'credit' (khata) sales.
// Wrapped in a transaction so a stock-out mid-checkout leaves nothing half-applied.
const createSale = asyncHandler(async (req, res) => {
  const { items, customerId, discount = 0, tax = 0, paymentMethod = 'cash', amountPaid } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Sale must contain at least one item');
  }

  const session = await mongoose.startSession();
  try {
    let createdSale;
    await session.withTransaction(async () => {
      const saleItems = [];
      let subtotal = 0;

      for (const line of items) {
        const product = await Product.findOne({ _id: line.productId, shopId: req.shopId }).session(session);
        if (!product) {
          res.status(404);
          throw new Error(`Product ${line.productId} not found`);
        }
        if (product.stockQuantity < line.quantity) {
          res.status(400);
          throw new Error(`Insufficient stock for ${product.name} (available: ${product.stockQuantity})`);
        }

        const lineSubtotal = product.sellingPrice * line.quantity;
        subtotal += lineSubtotal;

        saleItems.push({
          productId: product._id,
          name: product.name,
          quantity: line.quantity,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          subtotal: lineSubtotal,
        });

        await Product.updateOne(
          { _id: product._id, shopId: req.shopId },
          { $inc: { stockQuantity: -line.quantity } }
        ).session(session);
      }

      const totalAmount = Math.max(subtotal - discount + tax, 0);
      const paid = amountPaid !== undefined ? amountPaid : totalAmount;

      if (paymentMethod === 'credit') {
        if (!customerId) {
          res.status(400);
          throw new Error('A customer is required for credit (khata) sales');
        }
        const customer = await Customer.findOne({ _id: customerId, shopId: req.shopId }).session(session);
        if (!customer) {
          res.status(404);
          throw new Error('Customer not found');
        }
        const unpaid = totalAmount - paid;
        if (unpaid > 0) {
          await Customer.updateOne(
            { _id: customerId, shopId: req.shopId },
            { $inc: { creditBalance: unpaid } }
          ).session(session);
        }
      }

      const [sale] = await Sale.create(
        [
          {
            shopId: req.shopId,
            customerId: customerId || undefined,
            items: saleItems,
            subtotal,
            discount,
            tax,
            totalAmount,
            paymentMethod,
            amountPaid: paid,
            cashierId: req.userId,
            receiptNumber: generateReceiptNumber(),
          },
        ],
        { session }
      );
      createdSale = sale;
    });

    res.status(201).json({ success: true, data: createdSale });
  } finally {
    session.endSession();
  }
});

// Reverses stock for a sale (full refund only, mirrors real shop-counter behaviour).
const refundSale = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedSale;
    await session.withTransaction(async () => {
      const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId }).session(session);
      if (!sale) {
        res.status(404);
        throw new Error('Sale not found');
      }
      if (sale.status !== 'completed') {
        res.status(400);
        throw new Error(`Cannot refund a sale with status '${sale.status}'`);
      }

      for (const item of sale.items) {
        await Product.updateOne(
          { _id: item.productId, shopId: req.shopId },
          { $inc: { stockQuantity: item.quantity } }
        ).session(session);
      }

      if (sale.paymentMethod === 'credit' && sale.customerId) {
        const unpaid = sale.totalAmount - sale.amountPaid;
        if (unpaid > 0) {
          await Customer.updateOne(
            { _id: sale.customerId, shopId: req.shopId },
            { $inc: { creditBalance: -unpaid } }
          ).session(session);
        }
      }

      sale.status = 'refunded';
      await sale.save({ session });
      updatedSale = sale;
    });

    res.json({ success: true, data: updatedSale });
  } finally {
    session.endSession();
  }
});

module.exports = { getSales, getSale, createSale, refundSale };
