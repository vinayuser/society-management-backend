const db = require('../config/database');
const { getRelativeUrl } = require('../middleware/upload');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapGuardRow(r) {
  return {
    id: r.id,
    societyId: r.society_id,
    userId: r.user_id,
    name: r.name,
    phone: r.phone,
    profilePicture: r.profile_picture,
    email: r.email,
    employeeId: r.employee_id,
    role: r.role,
    assignedBlocks: r.assigned_blocks,
    joiningDate: r.joining_date,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { role, block, shiftDate } = req.query;
    let sql = `SELECT id, society_id, user_id, name, phone, profile_picture, email, employee_id, role, assigned_blocks, joining_date, is_active, created_at, updated_at
      FROM guards WHERE society_id = ?`;
    const params = [societyId];
    if (role && String(role).trim()) {
      sql += ' AND role = ?';
      params.push(String(role).trim());
    }
    if (block && String(block).trim()) {
      sql += ' AND (assigned_blocks LIKE ? OR assigned_blocks = ?)';
      const term = '%' + String(block).trim() + '%';
      params.push(term, term);
    }
    sql += ' ORDER BY name';
    const [rows] = await db.pool.execute(sql, params);
    let data = rows.map(mapGuardRow);
    if (shiftDate && data.length > 0) {
      const guardIds = data.map((g) => g.id);
      const placeholders = guardIds.map(() => '?').join(',');
      const [shiftRows] = await db.pool.execute(
        `SELECT guard_id, shift_start, shift_end, assigned_gate FROM guard_shifts
         WHERE guard_id IN (${placeholders}) AND society_id = ? AND DATE(shift_start) = ?`,
        [...guardIds, societyId, shiftDate]
      );
      const byGuard = {};
      shiftRows.forEach((s) => {
        if (!byGuard[s.guard_id]) byGuard[s.guard_id] = [];
        byGuard[s.guard_id].push({
          shiftStart: s.shift_start,
          shiftEnd: s.shift_end,
          assignedGate: s.assigned_gate,
        });
      });
      data = data.map((g) => ({ ...g, shifts: byGuard[g.id] || [] }));
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, user_id, name, phone, profile_picture, email, employee_id, role, assigned_blocks, joining_date, is_active, created_at, updated_at
       FROM guards WHERE id = ? AND society_id = ?`,
      [id, societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }
    res.json({ success: true, data: mapGuardRow(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { name, phone, email, employeeId, role, assignedBlocks, joiningDate } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO guards (society_id, name, phone, email, employee_id, role, assigned_blocks, joining_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        societyId,
        name || '',
        phone || '',
        email || null,
        employeeId || null,
        role || 'guard',
        assignedBlocks || null,
        joiningDate || null,
      ]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        name: name || '',
        phone: phone || '',
        email: email || null,
        employeeId: employeeId || null,
        role: role || 'guard',
        assignedBlocks: assignedBlocks || null,
        joiningDate: joiningDate || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { name, phone, email, employeeId, role, assignedBlocks, joiningDate, isActive } = req.body;
    const updates = [];
    const values = [];
    const fields = [
      ['name', name],
      ['phone', phone],
      ['email', email],
      ['employee_id', employeeId],
      ['role', role],
      ['assigned_blocks', assignedBlocks],
      ['joining_date', joiningDate],
    ];
    fields.forEach(([col, val]) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val === null || val === '' ? null : val);
      }
    });
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE guards SET ${updates.join(', ')} WHERE id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }
    res.json({ success: true, message: 'Guard updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM guards WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }
    res.json({ success: true, message: 'Guard deleted' });
  } catch (err) {
    next(err);
  }
}

async function uploadProfile(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const relativeUrl = getRelativeUrl(societyId, 'profile', req.file.filename);
    const [result] = await db.pool.execute(
      'UPDATE guards SET profile_picture = ? WHERE id = ? AND society_id = ?',
      [relativeUrl, id, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found' });
    }
    res.json({ success: true, data: { profilePicture: relativeUrl } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, uploadProfile };
