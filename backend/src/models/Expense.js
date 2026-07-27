const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'salaries', 'transport', 'maintenance', 'supplies', 'other'],
      default: 'other',
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

expenseSchema.index({ shopId: 1, date: -1 });
expenseSchema.index({ shopId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
