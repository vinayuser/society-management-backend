const express = require('express');
const plansController = require('../controllers/plansController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);

router.get('/', plansController.list);

router.post('/', superAdminOnly, plansController.create);
router.patch('/:id', superAdminOnly, plansController.update);

module.exports = router;
