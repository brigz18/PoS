const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Roles:
 *  - owner            : subscribes to the platform, full access to their business
 *  - manager          : manages products, inventory, customers, suppliers, cashiers/staff, reports
 *  - cashier          : operates the POS terminal, processes sales
 *  - inventory_staff  : manages products/inventory only
 */
const ROLES = ['owner', 'manager', 'cashier', 'inventory_staff'];

const userSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'cashier' },
    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Email is globally unique across the whole platform (not just per-business),
// because login looks a user up by email alone: User.findOne({ email }).
// If two businesses could share an email, login would be ambiguous and would
// always resolve to whichever account was created first - silently locking
// the other one out. The `unique: true` on the email field above enforces this.

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
