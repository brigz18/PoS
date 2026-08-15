const jwt = require('jsonwebtoken');

// Generates a signed JWT containing the user id, business id, and role.
// NOTE: the User schema's field is `business` (see models/User.js), not
// `businessId` - keep this in sync or every token silently bakes in
// `businessId: undefined`.
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      businessId: user.business,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
