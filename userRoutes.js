const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, resetUserPassword, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('owner', 'manager'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.put('/:id/reset-password', resetUserPassword);

module.exports = router;
