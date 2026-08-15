const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Business = require('../models/Business');

// Verifies the Bearer JWT, then loads the *current* User and Business
// documents fresh from the DB on every request (rather than trusting
// whatever was true when the token was issued) so a deactivated employee or
// a deactivated business is locked out immediately, not just after their
// token happens to expire.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // js/api.js forces a re-login on the client whenever the error message
    // contains the word "token" - keep that substring in both branches below.
    res.status(401);
    throw new Error('Not authorized, invalid or expired token');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(401);
    throw new Error('Not authorized, the account for this token no longer exists');
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact your business owner.');
  }

  const business = await Business.findById(user.business);
  if (!business || !business.isActive) {
    res.status(403);
    throw new Error('This business account is inactive');
  }

  req.user = user;
  req.business = business;
  next();
});

// Gate for a specific granular permission (see utils/permissions.js for the
// full key list). Owners always pass, matching every permission check the
// frontend performs client-side. 'always' is the pseudo-permission used for
// pages every logged-in account can reach (e.g. Settings) - just being
// authenticated (protect already ran) is enough.
const requirePermission = (key) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }
    if (key === 'always' || req.user.role === 'owner') {
      return next();
    }
    const granted = req.user.permissions && req.user.permissions[key] === true;
    if (!granted) {
      res.status(403);
      throw new Error(`You don't have permission to perform this action (${key})`);
    }
    next();
  });

// Blocks business-data routes once a subscription has lapsed. Responds 402
// specifically because js/api.js watches for exactly that status code and
// automatically pops the non-dismissable renewal modal - any other status
// would just show as a generic error toast instead.
// Deliberately NOT applied to /api/auth/*, /api/payments/*, or
// /api/business (GET) - the Owner still needs to reach Settings, see their
// current plan, and pay, even while expired.
const checkSubscriptionActive = asyncHandler(async (req, res, next) => {
  const business = req.business;
  const expired =
    business.subscriptionStatus === 'expired' ||
    (business.subscriptionExpiresAt && new Date(business.subscriptionExpiresAt).getTime() < Date.now());

  if (expired) {
    res.status(402);
    throw new Error('Your subscription has expired. Please renew to continue using SmartPOS.');
  }
  next();
});

module.exports = { protect, requirePermission, checkSubscriptionActive };
