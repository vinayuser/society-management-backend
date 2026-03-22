const express = require('express');
const appController = require('../controllers/appController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { loadResidentFlats } = require('../middleware/residentContext');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

/**
 * App APIs for residents / society members (member-facing application).
 * All routes require authentication. Society context from JWT (scopeToUserSociety).
 */
router.use(authenticate, scopeToUserSociety, loadResidentFlats);

router.get('/my-flats', authorize('resident'), appController.myFlats);
router.get('/profile', appController.myProfile);
router.get('/directory', authorize('resident'), appController.directory);
router.get('/activity', authorize('resident'), appController.activityFeed);

module.exports = router;
