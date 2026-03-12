const express = require('express');
const complaintsController = require('../controllers/complaintsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { complaints: c } = require('../validations');

const router = express.Router();

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

router.use(authenticate, scopeToUserSociety);

router.get('/', allowList(['society_admin', 'resident', 'super_admin']), complaintsController.list);
router.post(
  '/',
  allowList(['resident', 'society_admin', 'super_admin']),
  validate(c.create),
  complaintsController.create
);
router.patch(
  '/:id/status',
  allowList(['society_admin', 'super_admin']),
  validate(c.idParam, 'params'),
  validate(c.updateStatus),
  complaintsController.updateStatus
);

module.exports = router;
