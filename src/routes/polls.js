const express = require('express');
const pollsController = require('../controllers/pollsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { polls: p } = require('../validations');

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

const router = express.Router();

router.use(authenticate, scopeToUserSociety);

router.get('/', allowList(['society_admin', 'resident', 'super_admin']), pollsController.list);
router.post('/', allowList(['society_admin', 'super_admin']), validate(p.create), pollsController.create);
router.post('/:id/vote', allowList(['resident', 'society_admin', 'super_admin']), validate(p.idParam, 'params'), validate(p.vote), pollsController.vote);
router.delete('/:id', allowList(['society_admin', 'super_admin']), validate(p.idParam, 'params'), pollsController.remove);

module.exports = router;
