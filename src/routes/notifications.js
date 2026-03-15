const express = require('express');
const notificationsController = require('../controllers/notificationsController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, notificationsController.list);
router.post('/mark-all-read', authenticate, notificationsController.markAllRead);
router.patch('/:id/read', authenticate, notificationsController.markRead);

module.exports = router;
