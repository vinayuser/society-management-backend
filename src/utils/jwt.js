const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(userId, role, societyId = null) {
  return jwt.sign(
    { userId, role, societyId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function signRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/** Short-lived token after OTP step for public resident signup flow. */
function signSignupSessionToken(contactType, contact) {
  return jwt.sign(
    { type: 'signup_session', contactType, contact },
    config.jwt.secret,
    { expiresIn: '60m' }
  );
}

function verifySignupSessionToken(token) {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (decoded.type !== 'signup_session') {
    const err = new Error('Invalid signup session');
    err.status = 401;
    throw err;
  }
  return decoded;
}

module.exports = { signAccessToken, signRefreshToken, verifyToken, signSignupSessionToken, verifySignupSessionToken };
