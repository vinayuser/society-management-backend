const express = require('express');
const paymentsController = require('../controllers/paymentsController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { payments: p } = require('../validations');

const router = express.Router();

router.use(authenticate);

function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin only' });
  }
  next();
}

router.get('/overview', superAdminOnly, paymentsController.overview);
router.get('/month-detail', superAdminOnly, paymentsController.monthDetail);
router.post('/send-reminder', superAdminOnly, validate(p.sendReminder), paymentsController.sendReminder);
router.post('/create-order', superAdminOnly, validate(p.createOrder), paymentsController.createOrder);
router.post('/generate-recurring', superAdminOnly, paymentsController.generateRecurring);

module.exports = router;
