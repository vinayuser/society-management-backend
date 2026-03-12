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

module.exports = { signAccessToken, signRefreshToken, verifyToken };
