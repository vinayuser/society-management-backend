const express = require('express');
const adsController = require('../controllers/adsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { ads: a } = require('../validations');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  scopeToUserSociety(req, res, next);
}, adsController.list);

router.post(
  '/',
  (req, res, next) => {
    if (req.user.role !== 'super_admin') scopeToUserSociety(req, res, next);
    else next();
  },
  validate(a.create),
  adsController.create
);

router.delete(
  '/:id',
  validate(a.idParam, 'params'),
  adsController.remove
);

module.exports = router;
