const express = require('express');
const noticesController = require('../controllers/noticesController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { notices: n } = require('../validations');

const router = express.Router();

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

router.use(authenticate, scopeToUserSociety);

router.get(
  '/',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  noticesController.list
);
router.post(
  '/',
  allowList(['society_admin', 'super_admin']),
  validate(n.create),
  noticesController.create
);
router.delete(
  '/:id',
  allowList(['society_admin', 'super_admin']),
  validate(n.idParam, 'params'),
  noticesController.remove
);

module.exports = router;
