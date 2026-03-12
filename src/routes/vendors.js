const express = require('express');
const vendorsController = require('../controllers/vendorsController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { vendors: v } = require('../validations');

const router = express.Router();

router.use(authenticate, adminOrSocietyAdmin, scopeToUserSociety);

router.get('/', vendorsController.list);
router.post('/', validate(v.create), vendorsController.create);
router.patch('/:id', validate(v.idParam, 'params'), validate(v.update), vendorsController.update);
router.delete('/:id', validate(v.idParam, 'params'), vendorsController.remove);

module.exports = router;
