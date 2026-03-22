const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapMemberRow(r) {
  return {
    id: r.id,
    memberId: r.id,
    flatId: r.flat_id,
    userId: r.user_id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    role: r.role,
    profileImage: r.profile_image,
    status: r.status,
    createdAt: r.created_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });

    const [allRows] = await db.pool.execute(
      `SELECT id, society_id, flat_id, user_id, name, phone, email, role, profile_image, status, created_at
       FROM members WHERE society_id = ? AND flat_id = ? ORDER BY name`,
      [societyId, flatId]
    );
    const mapped = allRows.map(mapMemberRow);
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 50, maxLimit: 200 });
    jsonCollection(res, mapped.slice(offset, offset + limit), { page, limit, total: mapped.length });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const { name, phone, email, role, userId } = req.body;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO members (society_id, flat_id, user_id, name, phone, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [societyId, flatId, userId || null, name || '', phone || null, email || null, role || 'family_member', 'active']
    );
    const [rows] = await db.pool.execute(
      'SELECT id, society_id, flat_id, user_id, name, phone, email, role, profile_image, status, created_at FROM members WHERE id = ?',
      [result.insertId]
    );
    const r = rows[0];
    res.status(201).json({
      success: true,
      data: mapMemberRow(r),
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const memberId = req.params.memberId;
    const body = req.body || {};
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });

    const set = [];
    const params = [];
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      set.push('name = ?');
      params.push(body.name || '');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
      set.push('phone = ?');
      params.push(body.phone ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      set.push('email = ?');
      params.push(body.email ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      set.push('role = ?');
      params.push(body.role);
    }
    if (set.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    set.push('updated_at = CURRENT_TIMESTAMP');
    params.push(memberId, flatId, societyId);
    const [result] = await db.pool.execute(
      `UPDATE members SET ${set.join(', ')} WHERE id = ? AND flat_id = ? AND society_id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    const [rows] = await db.pool.execute(
      'SELECT id, society_id, flat_id, user_id, name, phone, email, role, profile_image, status, created_at FROM members WHERE id = ?',
      [memberId]
    );
    res.json({ success: true, data: mapMemberRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const memberId = req.params.memberId;
    const [result] = await db.pool.execute('DELETE FROM members WHERE id = ? AND flat_id = ? AND society_id = ?', [
      memberId,
      flatId,
      societyId,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
