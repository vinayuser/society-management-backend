const express = require('express');
const signupRequestController = require('../controllers/signupRequestController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { signupRequests: s } = require('../validations');

const router = express.Router();

// Public: submit signup request (no auth)
router.post('/', validate(s.create), signupRequestController.create);

// Society admin: list and review
router.get('/', authenticate, adminOrSocietyAdmin, scopeToUserSociety, signupRequestController.list);
router.patch(
  '/:id',
  authenticate,
  adminOrSocietyAdmin,
  scopeToUserSociety,
  validate(s.idParam, 'params'),
  validate(s.review),
  signupRequestController.review
);

module.exports = router;
