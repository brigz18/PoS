const express = require('express');
const router = express.Router();
const { getPlans, checkout, renew } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Public: no account exists yet at checkout time for a brand-new sign-up,
// and js/api.js always calls checkout with auth:false even from the
// authenticated in-app renewal flow (see routes note in paymentController.js).
router.get('/plans', getPlans);
router.post('/checkout', checkout);

// Private: consuming a payment reference to actually extend a subscription
// requires knowing WHICH business is renewing, which only a valid session
// can tell us.
router.post('/renew', protect, renew);

module.exports = router;
