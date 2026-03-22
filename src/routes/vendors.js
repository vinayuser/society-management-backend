const express = require('express');
const vendorsController = require('../controllers/vendorsController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { vendors: v } = require('../validations');

const router = express.Router();

router.use(authenticate);

/** Society members (residents) can browse approved vendors; admins manage them. */
router.get('/', (req, res, next) => {
  if (req.user.role === 'resident') {
    return scopeToUserSociety(req, res, () => {
      if (!req.societyId) {
        return res.status(400).json({ success: false, message: 'Society context required' });
      }
      return next();
    });
  }
  return adminOrSocietyAdmin(req, res, () => scopeToUserSociety(req, res, next));
}, vendorsController.list);

router.post('/', adminOrSocietyAdmin, scopeToUserSociety, validate(v.create), vendorsController.create);
router.patch('/:id', adminOrSocietyAdmin, scopeToUserSociety, validate(v.idParam, 'params'), validate(v.update), vendorsController.update);
router.delete('/:id', adminOrSocietyAdmin, scopeToUserSociety, validate(v.idParam, 'params'), vendorsController.remove);

module.exports = router;
