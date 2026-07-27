const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    nameUrdu: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

categorySchema.index({ shopId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
