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
    const { flatId, date, exitNull } = req.query;
    let sql = `SELECT v.id, v.society_id, v.flat_id, v.visitor_name, v.visitor_phone, v.purpose, v.entry_time, v.exit_time, v.visitor_type, v.created_at,
      f.tower, f.flat_number
      FROM visitors v
      JOIN flats f ON f.id = v.flat_id
      WHERE v.society_id = ?`;
    const params = [societyId];
    if (req.user.role === 'resident' && req.myFlatIds && req.myFlatIds.length) {
      sql += ' AND v.flat_id IN (' + req.myFlatIds.map(() => '?').join(',') + ')';
      params.push(...req.myFlatIds);
    } else if (flatId) {
      sql += ' AND v.flat_id = ?';
      params.push(flatId);
    }
    if (date) {
      sql += ' AND DATE(v.entry_time) = ?';
      params.push(date);
    }
    if (exitNull === 'true' || exitNull === '1') {
      sql += ' AND v.exit_time IS NULL';
    }
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 50, maxLimit: 200 });
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS vis_count`;
    const [[{ total }]] = await db.pool.execute(countSql, params);
    sql += ` ORDER BY v.entry_time DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.pool.execute(sql, params);
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        flatId: r.flat_id,
        tower: r.tower,
        flatNumber: r.flat_number,
        visitorName: r.visitor_name,
        visitorPhone: r.visitor_phone,
        purpose: r.purpose,
        entryTime: r.entry_time,
        exitTime: r.exit_time,
        visitorType: r.visitor_type,
        createdAt: r.created_at,
      })),
      { page, limit, total: total ?? 0 }
    );
  } catch (err) {
    next(err);
  }
}

async function entry(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { flatId, visitorName, visitorPhone, purpose, visitorType } = req.body;
    if (req.user.role === 'resident') {
      if (!req.myFlatIds || !req.myFlatIds.length) {
        return res.status(403).json({ success: false, message: 'No flat assigned to your account' });
      }
      if (!flatId || !req.myFlatIds.includes(Number(flatId))) {
        return res.status(403).json({ success: false, message: 'You can only log visitors for your flat(s)' });
      }
    }
    const loggedBy = req.user?.id || null;
    const [result] = await db.pool.execute(
      `INSERT INTO visitors (society_id, flat_id, visitor_name, visitor_phone, purpose, entry_time, logged_by_user_id, visitor_type)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [societyId, flatId, visitorName, visitorPhone || null, purpose || null, loggedBy, visitorType || 'guest']
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        flatId,
        visitorName,
        entryTime: new Date(),
        visitorType: visitorType || 'guest',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function exit(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute(
      'UPDATE visitors SET exit_time = NOW() WHERE id = ? AND society_id = ? AND exit_time IS NULL',
      [id, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Visitor record not found or already exited' });
    }
    res.json({ success: true, message: 'Exit recorded' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, entry, exit };
