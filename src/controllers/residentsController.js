const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query);
    const [[{ total }]] = await db.pool.execute(
      'SELECT COUNT(*) AS total FROM residents r WHERE r.society_id = ?',
      [societyId]
    );
    const [rows] = await db.pool.execute(
      `SELECT r.id, r.society_id, r.user_id, r.flat_id, r.is_primary, r.created_at,
        u.name, u.email, u.phone, u.role,
        f.tower, f.flat_number
       FROM residents r
       JOIN users u ON u.id = r.user_id
       JOIN flats f ON f.id = r.flat_id
       WHERE r.society_id = ?
       ORDER BY f.tower, f.flat_number, u.name LIMIT ${limit} OFFSET ${offset}`,
      [societyId]
    );
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        flatId: r.flat_id,
        isPrimary: !!r.is_primary,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        tower: r.tower,
        flatNumber: r.flat_number,
        createdAt: r.created_at,
      })),
      { page, limit, total: total ?? 0 }
    );
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { name, email, phone, flatId, password, isPrimary } = req.body;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const [userResult] = await conn.execute(
        `INSERT INTO users (society_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'resident')`,
        [societyId, name, email || null, phone || null, passwordHash]
      );
      const userId = userResult.insertId;
      await conn.execute(
        'INSERT INTO residents (society_id, user_id, flat_id, is_primary) VALUES (?, ?, ?, ?)',
        [societyId, userId, flatId, isPrimary ? 1 : 0]
      );
      // Keep directory in sync: one member row per resident (app login = directory entry)
      await conn.execute(
        `INSERT INTO members (society_id, flat_id, user_id, name, phone, email, role, status)
         VALUES (?, ?, ?, ?, ?, ?, 'resident', 'active')`,
        [societyId, flatId, userId, name || '', phone || null, email || null]
      ).catch(() => {}); // ignore if members table missing or duplicate
      await conn.commit();
      res.status(201).json({
        success: true,
        data: { userId, flatId, societyId, name, email, phone },
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'User already exists for this society' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [residents] = await db.pool.execute('SELECT user_id, flat_id FROM residents WHERE id = ? AND society_id = ?', [id, societyId]);
    if (!residents.length) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }
    const { user_id: userId, flat_id: flatId } = residents[0];
    await db.pool.execute('DELETE FROM residents WHERE id = ?', [id]);
    // Keep directory in sync: remove member row for this user+flat
    await db.pool.execute(
      'DELETE FROM members WHERE society_id = ? AND user_id = ? AND flat_id = ?',
      [societyId, userId, flatId]
    ).catch(() => {});
    await db.pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Resident removed' });
  } catch (err) {
    next(err);
  }
}

async function setPassword(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { password } = req.body;
    const [rows] = await db.pool.execute(
      'SELECT r.user_id FROM residents r WHERE r.id = ? AND r.society_id = ?',
      [id, societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, rows[0].user_id]
    );
    res.json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove, setPassword };
