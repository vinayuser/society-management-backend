const express = require('express');
const deliveriesController = require('../controllers/deliveriesController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin, authorize } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { loadResidentFlats } = require('../middleware/residentContext');
const { validate } = require('../middleware/validate');
const { deliveries: d } = require('../validations');

const router = express.Router();

router.use(authenticate, scopeToUserSociety, loadResidentFlats);

router.get('/', authorize('society_admin', 'super_admin', 'resident'), deliveriesController.list);
router.post('/', adminOrSocietyAdmin, validate(d.create), deliveriesController.create);
router.patch('/:id/status', authorize('society_admin', 'super_admin', 'resident'), validate(d.idParam, 'params'), validate(d.updateStatus), deliveriesController.updateStatus);

module.exports = router;
