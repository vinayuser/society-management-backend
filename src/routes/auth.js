const express = require('express');
const authController = require('../controllers/authController');
const signupOtpController = require('../controllers/signupOtpController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auth: authValidation } = require('../validations');

const router = express.Router();

router.post('/signup-otp/request', validate(authValidation.signupOtpRequest), signupOtpController.requestOtp);
router.post('/signup-otp/verify', validate(authValidation.signupOtpVerify), signupOtpController.verifyOtp);

router.post('/login', validate(authValidation.login), authController.login);
router.post('/refresh', validate(authValidation.refresh), authController.refresh);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
