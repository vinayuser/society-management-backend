const express = require('express');
const societyInviteController = require('../controllers/societyInviteController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { societyInvite: inv } = require('../validations');
const { common } = require('../validations');

const router = express.Router();

router.post(
  '/',
  authenticate,
  superAdminOnly,
  validate(inv.createInvite),
  societyInviteController.createInvite
);

router.get('/', authenticate, superAdminOnly, societyInviteController.listInvites);
router.post('/:id/resend', authenticate, superAdminOnly, societyInviteController.resendInvite);
router.get('/:token', societyInviteController.getInviteByToken);

router.post(
  '/:token/accept',
  validate(inv.acceptInvite),
  societyInviteController.acceptInvite
);

module.exports = router;
