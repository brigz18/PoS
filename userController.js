const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Business = require('../models/Business');
const { ALL_GRANTED, defaultPermissionsForRole, sanitizePermissions } = require('../utils/permissions');

// Roles that an owner/manager is allowed to assign to a new employee.
// Owners can create managers, cashiers, and inventory staff.
// Managers can only create cashiers and inventory staff (not other managers or owners).
const assignableRolesFor = (creatorRole) => {
  if (creatorRole === 'owner') return ['manager', 'cashier', 'inventory_staff'];
  if (creatorRole === 'manager') return ['cashier', 'inventory_staff'];
  return [];
};

// The permission "ceiling" a given account is allowed to hand out to someone
// else. An Owner has no ceiling (can grant anything). Everyone else can only
// ever grant a SUBSET of what they personally have - this is the privilege-
// escalation guard: a Manager without e.g. manageSuppliers can never grant
// manageSuppliers to a Cashier they create, even by editing the request body.
const granterCeilingFor = (user) => {
  if (user.role === 'owner') return ALL_GRANTED;
  const perms = user.permissions;
  // req.user.permissions is normally a real Mongoose subdocument (has
  // .toObject()), but this is written defensively to also accept a plain
  // object, in case req.user is ever a .lean() result or similar in the future.
  return perms && typeof perms.toObject === 'function' ? perms.toObject() : perms || {};
};

// @desc    List all employees for the logged-in user's business
// @route   GET /api/users
// @access  Private (requires manageEmployees permission, or Owner)
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ business: req.business._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, data: users.map((u) => u.toSafeObject()) });
});

// @desc    Get a single employee
// @route   GET /api/users/:id
// @access  Private (requires manageEmployees permission, or Owner)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, business: req.business._id });
  if (!user) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json({ success: true, data: user.toSafeObject() });
});

// @desc    Create a new employee account (Manager, Cashier, or Inventory Staff),
//          with a fully custom set of granular permissions the Owner (or an
//          authorized Manager) controls. `permissions` in the request body is
//          optional - if omitted, sensible role-based defaults are applied,
//          but every flag can be overridden individually either way.
// @route   POST /api/users
// @access  Private (requires manageEmployees permission, or Owner)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, permissions } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400);
    throw new Error('name, email, password and role are required');
  }

  const allowedRoles = assignableRolesFor(req.user.role);
  if (!allowedRoles.includes(role)) {
    res.status(403);
    throw new Error(`Your role (${req.user.role}) cannot create a user with role '${role}'`);
  }

  const business = await Business.findById(req.business._id);
  const currentUserCount = await User.countDocuments({ business: business._id });
  if (currentUserCount >= business.maxUsers) {
    res.status(400);
    throw new Error(`User limit reached (${business.maxUsers}) for your current subscription plan. Please upgrade.`);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(400);
    throw new Error('An account with this email already exists on the platform');
  }

  const requestedPermissions = permissions !== undefined ? permissions : defaultPermissionsForRole(role);
  const finalPermissions = sanitizePermissions(requestedPermissions, granterCeilingFor(req.user));

  const user = await User.create({
    business: business._id,
    name,
    email: email.toLowerCase(),
    password,
    role,
    permissions: finalPermissions,
    phone: phone || '',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: user.toSafeObject() });
});

// @desc    Update an employee (name, phone, role, active status, permissions)
// @route   PUT /api/users/:id
// @access  Private (requires manageEmployees permission, or Owner)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, business: req.business._id });
  if (!user) {
    res.status(404);
    throw new Error('Employee not found');
  }

  if (user.role === 'owner') {
    res.status(403);
    throw new Error('The business owner account cannot be modified here');
  }

  const { name, phone, role, isActive, permissions } = req.body;

  if (role && role !== user.role) {
    const allowedRoles = assignableRolesFor(req.user.role);
    if (!allowedRoles.includes(role)) {
      res.status(403);
      throw new Error(`Your role (${req.user.role}) cannot assign role '${role}'`);
    }
    user.role = role;
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;

  if (permissions !== undefined) {
    // Sanitized/capped against the editor's own ceiling, same as creation -
    // a Manager editing another employee can never grant more than they have.
    user.permissions = sanitizePermissions(permissions, granterCeilingFor(req.user));
  }

  await user.save();
  res.json({ success: true, data: user.toSafeObject() });
});

// @desc    Reset an employee's password (owner/manager action)
// @route   PUT /api/users/:id/reset-password
// @access  Private (requires manageEmployees permission, or Owner)
const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('newPassword must be at least 6 characters');
  }

  const user = await User.findOne({ _id: req.params.id, business: req.business._id }).select('+password');
  if (!user || user.role === 'owner') {
    res.status(404);
    throw new Error('Employee not found');
  }

  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password reset successfully' });
});

// @desc    Deactivate / remove an employee
// @route   DELETE /api/users/:id
// @access  Private (requires manageEmployees permission, or Owner)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, business: req.business._id });
  if (!user) {
    res.status(404);
    throw new Error('Employee not found');
  }
  if (user.role === 'owner') {
    res.status(403);
    throw new Error('The business owner account cannot be deleted');
  }

  await user.deleteOne();
  res.json({ success: true, message: 'Employee removed successfully' });
});

module.exports = { getUsers, getUser, createUser, updateUser, resetUserPassword, deleteUser };
