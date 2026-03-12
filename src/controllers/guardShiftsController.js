const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapShift(r) {
  return {
    id: r.id,
    guardId: r.guard_id,
    societyId: r.society_id,
    shiftStart: r.shift_start,
    shiftEnd: r.shift_end,
    assignedGate: r.assigned_gate,
    createdAt: r.created_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { from, to } = req.query;
    if (!societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    let sql = 'SELECT id, guard_id, society_id, shift_start, shift_end, assigned_gate, created_at FROM guard_shifts WHERE society_id = ? AND guard_id = ?';
    const params = [societyId, guardId];
    if (from) { sql += ' AND shift_start >= ?'; params.push(from); }
    if (to) { sql += ' AND shift_end <= ?'; params.push(to); }
    sql += ' ORDER BY shift_start';
    const [rows] = await db.pool.execute(sql, params);
    res.json({ success: true, data: rows.map(mapShift) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { shiftStart, shiftEnd, assignedGate } = req.body;
    const [guardCheck] = await db.pool.execute('SELECT 1 FROM guards WHERE id = ? AND society_id = ?', [guardId, societyId]);
    if (!guardCheck.length) return res.status(404).json({ success: false, message: 'Guard not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO guard_shifts (guard_id, society_id, shift_start, shift_end, assigned_gate) VALUES (?, ?, ?, ?, ?)',
      [guardId, societyId, shiftStart, shiftEnd, assignedGate || null]
    );
    res.status(201).json({
      success: true,
      data: { id: result.insertId, guardId: Number(guardId), societyId, shiftStart, shiftEnd, assignedGate: assignedGate || null },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { shiftId } = req.params;
    const { shiftStart, shiftEnd, assignedGate } = req.body;
    const updates = [];
    const values = [];
    if (shiftStart !== undefined) { updates.push('shift_start = ?'); values.push(shiftStart); }
    if (shiftEnd !== undefined) { updates.push('shift_end = ?'); values.push(shiftEnd); }
    if (assignedGate !== undefined) { updates.push('assigned_gate = ?'); values.push(assignedGate || null); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(shiftId, guardId, societyId);
    const [result] = await db.pool.execute(
      `UPDATE guard_shifts SET ${updates.join(', ')} WHERE id = ? AND guard_id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Shift not found' });
    res.json({ success: true, message: 'Shift updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const guardId = req.params.guardId || req.params.id;
    const { shiftId } = req.params;
    const [result] = await db.pool.execute('DELETE FROM guard_shifts WHERE id = ? AND guard_id = ? AND society_id = ?', [shiftId, guardId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Shift not found' });
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
