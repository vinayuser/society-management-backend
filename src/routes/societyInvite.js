const express = require('express');
const societyInviteController = require('../controllers/societyInviteController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { societyInvite: inv } = require('../validations');
const { uploadOnboardingLogo } = require('../middleware/upload');

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
router.post('/:token/upload-logo', uploadOnboardingLogo, societyInviteController.uploadLogo);

router.post(
  '/:token/accept',
  validate(inv.acceptInvite),
  societyInviteController.acceptInvite
);

router.post('/:token/create-setup-fee-order', societyInviteController.createSetupFeeOrder);
router.post('/:token/create-setup-order', validate(inv.createSetupOrder), societyInviteController.createSetupOrder);
router.post('/:token/verify-payment', validate(inv.verifyPayment), societyInviteController.verifyPayment);

module.exports = router;
