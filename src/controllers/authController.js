const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const config = require('../config');

async function login(req, res, next) {
  try {
    const { email, password, phone, otp } = req.body;
    let user = null;

    if (phone && otp) {
      // OTP login (simplified: in production verify OTP from otp_verification table)
      const [users] = await db.pool.execute(
        'SELECT id, society_id, name, email, phone, role FROM users WHERE phone = ? AND is_active = 1',
        [phone]
      );
      user = users[0] || null;
    } else if (email && password) {
      const [users] = await db.pool.execute(
        'SELECT id, society_id, name, email, phone, password_hash, role FROM users WHERE email = ? AND is_active = 1',
        [email]
      );
      const u = users[0];
      if (!u || !u.password_hash) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      const match = await bcrypt.compare(password, u.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      user = { id: u.id, society_id: u.society_id, name: u.name, email: u.email, phone: u.phone, role: u.role };
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user.id, user.role, user.society_id);
    const refreshToken = signRefreshToken(user.id);

    await db.pool.execute(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
      [user.id, refreshToken]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          societyId: user.society_id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        accessToken,
        refreshToken,
        expiresIn: config.jwt.expiresIn,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    const decoded = verifyToken(refreshToken);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const [users] = await db.pool.execute(
      'SELECT id, society_id, name, email, phone, role FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = users[0];
    const accessToken = signAccessToken(user.id, user.role, user.society_id);
    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: config.jwt.expiresIn,
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const [users] = await db.pool.execute(
      `SELECT u.id, u.society_id, u.name, u.email, u.phone, u.role, u.email_verified, u.phone_verified,
       s.name as society_name, s.alias as society_alias
       FROM users u
       LEFT JOIN societies s ON s.id = u.society_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = users[0];
    res.json({
      success: true,
      data: {
        id: u.id,
        societyId: u.society_id,
        societyName: u.society_name,
        societyAlias: u.society_alias,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        emailVerified: !!u.email_verified,
        phoneVerified: !!u.phone_verified,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const decoded = verifyToken(token);
      await db.pool.execute(
        'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
        [decoded.userId]
      );
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, me, logout };
