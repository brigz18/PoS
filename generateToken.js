const jwt = require('jsonwebtoken');

// Generates a signed JWT containing the user id, business id, and role.
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      businessId: user.businessId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
