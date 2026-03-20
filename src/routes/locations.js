const express = require('express');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { pinState, stateIdParam } = require('../validations/locations');
const locationsController = require('../controllers/locationsController');

const router = express.Router();

// Public dropdown endpoints
router.get('/countries', locationsController.listCountries);
router.get('/states', locationsController.listStates);
router.get('/cities', locationsController.listCities);

// Super-admin: pin state to appear on top
router.patch(
  '/states/:id/pin',
  authenticate,
  superAdminOnly,
  validate(stateIdParam, 'params'),
  validate(pinState),
  locationsController.pinState
);

module.exports = router;

