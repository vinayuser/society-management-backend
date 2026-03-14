const express = require('express');
const societyController = require('../controllers/societyController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly, adminOrSocietyAdmin } = require('../middleware/authorize');
const { resolveTenant, requireTenant, scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { society: soc } = require('../validations');

const router = express.Router();

// Public: list active societies for member signup (id, name, alias)
router.get('/list', societyController.listForSignup);
// Public: towers and flats for signup form (no auth)
router.get('/:id/towers', societyController.listTowersForSignup);
router.get('/:id/flats', societyController.listFlatsForSignup);

router.get('/', authenticate, superAdminOnly, societyController.list);
router.get('/config', resolveTenant, requireTenant, societyController.getConfig);
router.get('/me/config', authenticate, scopeToUserSociety, societyController.getConfig);

router.patch(
  '/me/config',
  authenticate,
  scopeToUserSociety,
  validate(soc.updateConfig),
  societyController.updateConfig
);

router.get(
  '/:id',
  authenticate,
  adminOrSocietyAdmin,
  validate(soc.idParam, 'params'),
  societyController.getById
);

router.patch(
  '/:id/status',
  authenticate,
  superAdminOnly,
  validate(soc.idParam, 'params'),
  validate(soc.updateStatus),
  societyController.updateStatus
);

router.patch(
  '/:id',
  authenticate,
  adminOrSocietyAdmin,
  validate(soc.idParam, 'params'),
  validate(soc.update),
  societyController.update
);

module.exports = router;
