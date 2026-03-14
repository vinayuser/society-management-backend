const express = require('express');
const residentsController = require('../controllers/residentsController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { residents: r } = require('../validations');

const router = express.Router();

router.use(authenticate, adminOrSocietyAdmin, scopeToUserSociety);

router.get('/', residentsController.list);
router.post('/', validate(r.create), residentsController.create);
router.patch('/:id/password', validate(r.idParam, 'params'), validate(r.setPassword), residentsController.setPassword);
router.delete('/:id', validate(r.idParam, 'params'), residentsController.remove);

module.exports = router;
