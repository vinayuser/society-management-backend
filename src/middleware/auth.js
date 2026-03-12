const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const [users] = await db.pool.execute(
      'SELECT id, society_id, name, email, phone, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = {
      id: user.id,
      societyId: user.society_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    next(err);
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, config.jwt.secret, async (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }
    try {
      const [users] = await db.pool.execute(
        'SELECT id, society_id, name, email, phone, role, is_active FROM users WHERE id = ?',
        [decoded.userId]
      );
      req.user = users.length && users[0].is_active ? {
        id: users[0].id,
        societyId: users[0].society_id,
        name: users[0].name,
        email: users[0].email,
        phone: users[0].phone,
        role: users[0].role,
      } : null;
    } catch (e) {
      req.user = null;
    }
    next();
  });
}

module.exports = { authenticate, optionalAuth };
