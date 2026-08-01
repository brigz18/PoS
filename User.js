const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PERMISSION_KEYS } = require('../utils/permissions');

/**
 * Roles:
 *  - owner            : subscribes to the platform, full access to their business
 *                        (always bypasses the `permissions` object below - see
 *                        requirePermission() in middleware/auth.js)
 *  - manager           : default template = manage products/inventory/customers/
 *                        suppliers/employees, view dashboard + sales history
 *  - cashier           : default template = POS Terminal, manage inventory,
 *                        view dashboard + sales history
 *  - inventory_staff   : default template = manage inventory, view dashboard
 *                        + sales history
 *
 * These role templates are just a starting point applied at creation time -
 * the actual access control for every non-owner account is the granular
 * `permissions` object, which the Owner (or a Manager granted
 * `manageEmployees`) can freely customize per employee. See utils/permissions.js.
 */
const ROLES = ['owner', 'manager', 'cashier', 'inventory_staff'];

const permissionsSchemaFields = PERMISSION_KEYS.reduce(
  (fields, key) => ({ ...fields, [key]: { type: Boolean, default: false } }),
  {}
);

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
    // Granular per-employee access control - see utils/permissions.js.
    // Ignored entirely for role === 'owner' (an Owner always has full access).
    // Each key below already carries its own `default: false`
    // (built in permissionsSchemaFields), so no extra default is needed here.
    permissions: permissionsSchemaFields,
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
