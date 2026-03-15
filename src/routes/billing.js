const express = require('express');
const billingController = require('../controllers/billingController');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { billing: b } = require('../validations');

const router = express.Router();

const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  scopeToUserSociety(req, res, () => {
    if (!req.societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    next();
  });
}, billingController.list);

router.post(
  '/',
  (req, res, next) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super Admin only' });
    next();
  },
  validate(b.create),
  billingController.create
);

router.patch(
  '/:id/status',
  (req, res, next) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ success: false, message: 'Super Admin only' });
    next();
  },
  validate(b.idParam, 'params'),
  validate(b.updatePaymentStatus),
  billingController.updatePaymentStatus
);

router.post(
  '/:id/create-order',
  validate(b.idParam, 'params'),
  (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    scopeToUserSociety(req, res, () => {
      if (!req.societyId) return res.status(400).json({ success: false, message: 'Society context required' });
      next();
    });
  },
  billingController.createOrder
);
router.post('/verify-payment', validate(b.verifyPayment), (req, res, next) => {
  if (req.user.role === 'super_admin') return res.status(403).json({ success: false, message: 'Use Payments for super admin' });
  scopeToUserSociety(req, res, () => {
    if (!req.societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    next();
  });
}, billingController.verifyBillingPayment);

module.exports = router;
