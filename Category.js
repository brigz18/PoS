const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#3b82f6' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
