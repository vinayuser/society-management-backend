const express = require('express');
const lostFoundController = require('../controllers/lostFoundController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { lostFound: lf } = require('../validations');

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

const router = express.Router();

router.use(authenticate, scopeToUserSociety);

router.get('/', allowList(['society_admin', 'resident', 'super_admin']), lostFoundController.list);
router.post('/', allowList(['society_admin', 'resident', 'super_admin']), validate(lf.create), lostFoundController.create);
router.patch('/:id/status', allowList(['society_admin', 'super_admin']), validate(lf.idParam, 'params'), validate(lf.updateStatus), lostFoundController.updateStatus);
router.delete('/:id', allowList(['society_admin', 'super_admin']), validate(lf.idParam, 'params'), lostFoundController.remove);

module.exports = router;
