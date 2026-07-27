const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Business = require('../models/Business');

// Routes that must stay reachable even when a business's subscription has
// expired - otherwise the Owner could never see *why* they're locked out or
// pay to fix it. Everything else requires an active (non-expired) subscription.
const ALLOWED_WHEN_EXPIRED = [
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/business',
  '/api/payments/renew',
];

// Verifies the JWT sent in the Authorization header and attaches the
// authenticated user + business to req.user / req.business.
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error('Not authorized, user not found or deactivated');
  }

  const business = await Business.findById(user.business);
  if (!business || !business.isActive) {
    res.status(403);
    throw new Error('Business account is inactive');
  }

  const isExpired = business.subscriptionExpiresAt && business.subscriptionExpiresAt.getTime() < Date.now();
  if (isExpired && business.subscriptionStatus !== 'expired') {
    business.subscriptionStatus = 'expired';
    await business.save();
  }

  const isWhitelisted = ALLOWED_WHEN_EXPIRED.some((p) => req.originalUrl.startsWith(p));
  if (isExpired && !isWhitelisted) {
    res.status(402);
    throw new Error('Your subscription has expired. Please renew your plan to continue using SmartPOS.');
  }

  req.user = user;
  req.business = business;
  next();
});

// Restricts a route to a specific set of roles, e.g. authorize('owner', 'manager')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error(`Role '${req.user ? req.user.role : 'unknown'}' is not permitted to perform this action`);
  }
  next();
};

module.exports = { protect, authorize };
