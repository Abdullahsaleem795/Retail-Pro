const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');

const getPurchases = asyncHandler(async (req, res) => {
  const { status, supplierId, page = 1, limit = 20 } = req.query;
  const query = { shopId: req.shopId };
  if (status) query.status = status;
  if (supplierId) query.supplierId = supplierId;

  const skip = (Number(page) - 1) * Number(limit);
  const [purchases, total] = await Promise.all([
    Purchase.find(query)
      .populate('supplierId', 'name phone')
      .populate('items.productId', 'name sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Purchase.countDocuments(query),
  ]);

  res.json({ success: true, count: purchases.length, total, page: Number(page), data: purchases });
});

const getPurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId })
    .populate('supplierId', 'name phone')
    .populate('items.productId', 'name sku');
  if (!purchase) {
    res.status(404);
    throw new Error('Purchase not found');
  }
  res.json({ success: true, data: purchase });
});

// Creates a purchase order in 'pending' status. Stock is only added once it's
// marked 'received' via markReceived, mirroring how goods actually arrive at a shop.
const createPurchase = asyncHandler(async (req, res) => {
  const { supplierId, items, amountPaid, invoiceNumber } = req.body;

  const supplier = await Supplier.findOne({ _id: supplierId, shopId: req.shopId });
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

  const purchase = await Purchase.create({
    shopId: req.shopId,
    supplierId,
    items,
    totalAmount,
    amountPaid: amountPaid || 0,
    invoiceNumber,
    createdBy: req.userId,
  });

  res.status(201).json({ success: true, data: purchase });
});

// Marks a purchase as received: atomically increments product stock and
// updates the supplier's outstanding balance in a single transaction.
const markReceived = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedPurchase;
    await session.withTransaction(async () => {
      const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId }).session(session);
      if (!purchase) {
        res.status(404);
        throw new Error('Purchase not found');
      }
      if (purchase.status === 'received') {
        res.status(400);
        throw new Error('Purchase already marked as received');
      }
      if (purchase.status === 'cancelled') {
        res.status(400);
        throw new Error('Cannot receive a cancelled purchase');
      }

      for (const item of purchase.items) {
        await Product.updateOne(
          { _id: item.productId, shopId: req.shopId },
          { $inc: { stockQuantity: item.quantity } }
        ).session(session);
      }

      const outstanding = purchase.totalAmount - purchase.amountPaid;
      if (outstanding > 0) {
        await Supplier.updateOne(
          { _id: purchase.supplierId, shopId: req.shopId },
          { $inc: { balance: outstanding } }
        ).session(session);
      }

      purchase.status = 'received';
      await purchase.save({ session });
      updatedPurchase = purchase;
    });

    res.json({ success: true, data: updatedPurchase });
  } finally {
    session.endSession();
  }
});

const cancelPurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId });
  if (!purchase) {
    res.status(404);
    throw new Error('Purchase not found');
  }
  if (purchase.status === 'received') {
    res.status(400);
    throw new Error('Cannot cancel a purchase that has already been received');
  }
  purchase.status = 'cancelled';
  await purchase.save();
  res.json({ success: true, data: purchase });
});

module.exports = { getPurchases, getPurchase, createPurchase, markReceived, cancelPurchase };
