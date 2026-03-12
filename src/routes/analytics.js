const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/authorize');

const router = express.Router();

router.get('/dashboard', authenticate, superAdminOnly, analyticsController.dashboard);

module.exports = router;
