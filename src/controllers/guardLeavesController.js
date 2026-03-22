const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapLeave(r) {
  return {
    id: r.id,
    guardId: r.guard_id,
    societyId: r.society_id,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { status } = req.query;
    if (!societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    let sql = 'SELECT id, guard_id, society_id, leave_type, start_date, end_date, status, notes, created_at, updated_at FROM guard_leaves WHERE society_id = ?';
    const params = [societyId];
    if (guardId) { sql += ' AND guard_id = ?'; params.push(guardId); }
    if (status && String(status).trim()) { sql += ' AND status = ?'; params.push(String(status).trim()); }
    const { page, limit, offset } = normalizePageLimit(req.query);
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS gl_count`;
    const [[{ total }]] = await db.pool.execute(countSql, params);
    sql += ` ORDER BY start_date DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.pool.execute(sql, params);
    jsonCollection(res, rows.map(mapLeave), { page, limit, total: total ?? 0 });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { leaveType, startDate, endDate, notes } = req.body;
    const [guardCheck] = await db.pool.execute('SELECT 1 FROM guards WHERE id = ? AND society_id = ?', [guardId, societyId]);
    if (!guardCheck.length) return res.status(404).json({ success: false, message: 'Guard not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO guard_leaves (guard_id, society_id, leave_type, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [guardId, societyId, leaveType || 'casual', startDate, endDate, notes || null]
    );
    res.status(201).json({
      success: true,
      data: { id: result.insertId, guardId: Number(guardId), societyId, leaveType: leaveType || 'casual', startDate, endDate, status: 'pending', notes: notes || null },
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { leaveId } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    const [result] = await db.pool.execute(
      'UPDATE guard_leaves SET status = ? WHERE id = ? AND guard_id = ? AND society_id = ?',
      [status, leaveId, guardId, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, message: 'Leave status updated', data: { status } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { leaveId } = req.params;
    const [result] = await db.pool.execute('DELETE FROM guard_leaves WHERE id = ? AND guard_id = ? AND society_id = ?', [leaveId, guardId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, message: 'Leave deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updateStatus, remove };
