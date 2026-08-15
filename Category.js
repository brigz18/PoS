const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    color: { type: String, default: '#3b82f6', trim: true },
  },
  { timestamps: true }
);

// A business can't have two categories with the same name (case-insensitive
// would be nicer, but a plain compound unique index keeps this dependency-free).
categorySchema.index({ business: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
