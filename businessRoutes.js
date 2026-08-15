const express = require('express');
const router = express.Router();
const { getBusiness, updateBusiness } = require('../controllers/businessController');
const { protect, requirePermission } = require('../middleware/auth');

// Deliberately NOT gated by checkSubscriptionActive - the Settings page
// (and the subscription status card on it) has to stay reachable even
// after a subscription lapses, or the Owner would have no way back in.
router.use(protect);
router.use(requirePermission('always'));

router.route('/').get(getBusiness).put(updateBusiness);

module.exports = router;
