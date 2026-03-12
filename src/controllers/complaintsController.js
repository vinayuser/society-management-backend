const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { status, userId } = req.query;
    let sql = `SELECT c.id, c.society_id, c.user_id, c.title, c.description, c.category, c.status, c.assigned_staff_id, c.resolved_at, c.created_at,
      u.name as user_name, u.phone as user_phone
      FROM complaints c
      JOIN users u ON u.id = c.user_id
      WHERE c.society_id = ?`;
    const params = [societyId];
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (userId) {
      sql += ' AND c.user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY c.created_at DESC';
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userPhone: r.user_phone,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        assignedStaffId: r.assigned_staff_id,
        resolvedAt: r.resolved_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const userId = req.user.id;
    const { title, description, category } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO complaints (society_id, user_id, title, description, category, status) VALUES (?, ?, ?, ?, ?, "open")',
      [societyId, userId, title, description, category || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        userId,
        title,
        description,
        category,
        status: 'open',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { status, assignedStaffId } = req.body;
    const updates = [];
    const values = [];
    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'resolved') {
        updates.push('resolved_at = NOW()');
      }
    }
    if (assignedStaffId !== undefined) {
      updates.push('assigned_staff_id = ?');
      values.push(assignedStaffId || null);
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE complaints SET ${updates.join(', ')} WHERE id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.json({ success: true, message: 'Complaint updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updateStatus };
