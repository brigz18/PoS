const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PERMISSION_KEYS } = require('../utils/permissions');

// Build the permissions sub-schema dynamically from PERMISSION_KEYS so this
// file never has to be hand-edited when a new permission is added -
// utils/permissions.js stays the single source of truth.
const permissionsSchemaFields = {};
PERMISSION_KEYS.forEach((key) => {
  permissionsSchemaFields[key] = { type: Boolean, default: false };
});
const permissionsSchema = new mongoose.Schema(permissionsSchemaFields, { _id: false });

const userSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'cashier', 'inventory_staff'],
      required: true,
    },
    permissions: {
      type: permissionsSchema,
      default: () => ({}),
    },
    phone: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Hash the password whenever it's set/changed - covers both User.create()
// and `user.password = 'new'; user.save()` (password resets, self change).
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Strips the password hash (and Mongoose internals) before a user document
// is ever sent to the client - used everywhere instead of returning the raw
// document, so a forgotten `.select('+password')` upstream can never leak a
// hash into an API response.
userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
