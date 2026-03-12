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
    const { date, flatId, flat } = req.query;
    let sql = `SELECT d.id, d.society_id, d.flat_id, d.delivery_type, d.package_photo, d.received_by_guard,
      d.status, d.received_at, d.collected_at, d.created_at,
      f.tower, f.flat_number
      FROM deliveries d
      JOIN flats f ON f.id = d.flat_id
      WHERE d.society_id = ?`;
    const params = [societyId];
    if (req.user.role === 'resident' && req.myFlatIds && req.myFlatIds.length) {
      sql += ' AND d.flat_id IN (' + req.myFlatIds.map(() => '?').join(',') + ')';
      params.push(...req.myFlatIds);
    } else {
      if (flatId) {
        sql += ' AND d.flat_id = ?';
        params.push(flatId);
      }
      if (flat && String(flat).trim()) {
        const flatTerm = '%' + String(flat).trim() + '%';
        sql += ' AND (f.tower LIKE ? OR f.flat_number LIKE ?)';
        params.push(flatTerm, flatTerm);
      }
    }
    if (date) {
      sql += ' AND DATE(d.received_at) = ?';
      params.push(date);
    }
    sql += ' ORDER BY d.received_at DESC LIMIT 500';
    const [rows] = await db.pool.execute(sql, params);
    const guardIds = [...new Set(rows.map((r) => r.received_by_guard).filter(Boolean))];
    let guardMap = {};
    if (guardIds.length) {
      const placeholders = guardIds.map(() => '?').join(',');
      const [users] = await db.pool.query('SELECT id, name FROM users WHERE id IN (' + placeholders + ')', guardIds);
      users.forEach((u) => { guardMap[u.id] = u.name; });
    }
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        flatId: r.flat_id,
        tower: r.tower,
        flatNumber: r.flat_number,
        flatLabel: r.tower + '-' + r.flat_number,
        deliveryType: r.delivery_type,
        packagePhoto: r.package_photo,
        receivedByGuard: r.received_by_guard ? guardMap[r.received_by_guard] : null,
        status: r.status,
        receivedAt: r.received_at,
        collectedAt: r.collected_at,
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
    const userId = req.user?.id || null;
    const { flatId, deliveryType, packagePhoto } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO deliveries (society_id, flat_id, delivery_type, package_photo, received_by_guard, status)
       VALUES (?, ?, ?, ?, ?, 'received')`,
      [societyId, flatId, deliveryType || 'courier', packagePhoto || null, userId]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        flatId,
        deliveryType: deliveryType || 'courier',
        status: 'received',
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
    const { status } = req.body;
    if (req.user.role === 'resident') {
      const [rows] = await db.pool.execute('SELECT flat_id FROM deliveries WHERE id = ? AND society_id = ?', [id, societyId]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
      if (!req.myFlatIds || !req.myFlatIds.includes(rows[0].flat_id)) {
        return res.status(403).json({ success: false, message: 'You can only update deliveries for your flat' });
      }
    }
    const updates = ['status = ?'];
    const values = [status];
    if (status === 'collected') {
      updates.push('collected_at = NOW()');
    }
    values.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE deliveries SET ${updates.join(', ')} WHERE id = ? AND society_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updateStatus };
