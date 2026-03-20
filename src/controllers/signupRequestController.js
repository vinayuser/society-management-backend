const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

/** Public: create a signup request (member wants to join society) */
async function create(req, res, next) {
  try {
    const { societyId, countryId, stateId, cityId, name, email, phone, tower, flatNumber, password } = req.body;
    const [societies] = await db.pool.execute(
      'SELECT id, name, status, country_id, state_id, city_id FROM societies WHERE id = ?',
      [societyId]
    );
    if (!societies.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    if (societies[0].status !== 'active') {
      return res.status(400).json({ success: false, message: 'Society is not accepting signups' });
    }

    const societyRow = societies[0];
    if (!societyRow.country_id || !societyRow.state_id || !societyRow.city_id) {
      return res.status(400).json({ success: false, message: 'Society location not configured' });
    }
    if (
      Number(societyRow.country_id) !== Number(countryId) ||
      Number(societyRow.state_id) !== Number(stateId) ||
      Number(societyRow.city_id) !== Number(cityId)
    ) {
      return res.status(400).json({ success: false, message: 'Selected location does not match society address' });
    }

    const [flatRows] = await db.pool.execute(
      'SELECT id FROM flats WHERE society_id = ? AND tower = ? AND flat_number = ?',
      [societyId, tower.trim(), flatNumber.trim()]
    );
    if (!flatRows.length) {
      return res.status(400).json({ success: false, message: 'Flat not found in this society. Check tower and flat number.' });
    }
    const [existing] = await db.pool.execute(
      'SELECT id FROM users WHERE email = ? AND (society_id = ? OR society_id IS NULL)',
      [email, societyId]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists for this society' });
    }
    const [pending] = await db.pool.execute(
      'SELECT id FROM resident_signup_requests WHERE society_id = ? AND email = ? AND status = ?',
      [societyId, email, 'pending']
    );
    if (pending.length) {
      return res.status(409).json({ success: false, message: 'You already have a pending request for this society' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.pool.execute(
      `INSERT INTO resident_signup_requests
        (society_id, country_id, state_id, city_id, name, email, phone, tower, flat_number, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        societyId,
        countryId,
        stateId,
        cityId,
        name.trim(),
        email.trim(),
        (phone || '').trim() || null,
        tower.trim(),
        flatNumber.trim(),
        passwordHash,
      ]
    );
    const requestId = result.insertId;
    const societyName = societies[0].name;
    try {
      const [admins] = await db.pool.execute(
        'SELECT u.email FROM users u WHERE u.society_id = ? AND u.role = ? AND u.is_active = 1',
        [societyId, 'society_admin']
      );
      if (admins.length && emailService.sendSignupRequestNotification) {
        await Promise.all(
          admins.map((a) =>
            emailService.sendSignupRequestNotification(a.email, societyName, name, email)
          )
        );
      }
    } catch (e) {
      console.warn('Signup request notification failed:', e.message);
    }
    res.status(201).json({
      success: true,
      data: { id: requestId, message: 'Request submitted. Society admin will review. You can log in after approval.' },
    });
  } catch (err) {
    next(err);
  }
}

/** Society admin: list signup requests */
async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { status } = req.query;
    let sql = `SELECT id, society_id, country_id, state_id, city_id, name, email, phone, tower, flat_number, status, rejection_reason, reviewed_at, created_at
               FROM resident_signup_requests WHERE society_id = ?`;
    const params = [societyId];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        countryId: r.country_id,
        stateId: r.state_id,
        cityId: r.city_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        tower: r.tower,
        flatNumber: r.flat_number,
        status: r.status,
        rejectionReason: r.rejection_reason,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** Society admin: approve or reject */
async function review(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const [rows] = await db.pool.execute(
      'SELECT * FROM resident_signup_requests WHERE id = ? AND society_id = ? AND status = ?',
      [id, societyId, 'pending']
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }
    const reqRow = rows[0];
    if (status === 'rejected') {
      await db.pool.execute(
        'UPDATE resident_signup_requests SET status = ?, rejection_reason = ?, reviewed_at = NOW(), reviewed_by_user_id = ? WHERE id = ?',
        ['rejected', (rejectionReason || '').trim() || null, req.user.id, id]
      );
      return res.json({ success: true, message: 'Request rejected' });
    }
    if (status === 'approved') {
      const [flatRows] = await db.pool.execute(
        'SELECT id FROM flats WHERE society_id = ? AND tower = ? AND flat_number = ?',
        [reqRow.society_id, reqRow.tower, reqRow.flat_number]
      );
      const fid = flatRows[0]?.id;
      if (!fid) {
        return res.status(400).json({ success: false, message: 'Flat no longer exists' });
      }
      const conn = await db.pool.getConnection();
      try {
        await conn.beginTransaction();
        const [userResult] = await conn.execute(
          `INSERT INTO users (society_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'resident')`,
          [reqRow.society_id, reqRow.name, reqRow.email, reqRow.phone || null, reqRow.password_hash]
        );
        const userId = userResult.insertId;
        await conn.execute(
          'INSERT INTO residents (society_id, user_id, flat_id, is_primary) VALUES (?, ?, ?, 1)',
          [reqRow.society_id, userId, fid]
        );
        await conn.execute(
          `INSERT INTO members (society_id, flat_id, user_id, name, phone, email, role, status)
           VALUES (?, ?, ?, ?, ?, ?, 'resident', 'active')`,
          [reqRow.society_id, fid, userId, reqRow.name, reqRow.phone || null, reqRow.email]
        ).catch(() => {});
        await conn.execute(
          'UPDATE resident_signup_requests SET status = ?, reviewed_at = NOW(), reviewed_by_user_id = ? WHERE id = ?',
          ['approved', req.user.id, id]
        );
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      return res.json({ success: true, message: 'Request approved. Member can now log in.' });
    }
    return res.status(400).json({ success: false, message: 'Invalid status' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, review };
