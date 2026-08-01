const express = require('express');
const router = express.Router();
const { getPlans, checkout, renew } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Public: someone paying to register a brand-new business doesn't have an
// account yet, so this can't require a JWT.
router.get('/plans', getPlans);
router.post('/checkout', checkout);

// Private: renewing an existing business's subscription requires being
// logged in as that business's Owner.
router.post('/renew', protect, renew);

module.exports = router;
