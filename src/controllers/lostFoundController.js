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
    const { status } = req.query;
    let sql = `SELECT id, society_id, user_id, title, description, image_url, status, created_at
      FROM lost_found WHERE society_id = ?`;
    const params = [societyId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    const { page, limit, offset } = normalizePageLimit(req.query);
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS lf_count`;
    const [[{ total }]] = await db.pool.execute(countSql, params);
    sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.pool.execute(sql, params);
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        imageUrl: r.image_url,
        status: r.status,
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { title, description, imageUrl } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO lost_found (society_id, user_id, title, description, image_url, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [societyId, userId, title, description || null, imageUrl || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        userId,
        title,
        description: description || null,
        imageUrl: imageUrl || null,
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
    const { status } = req.body;
    const [result] = await db.pool.execute(
      'UPDATE lost_found SET status = ? WHERE id = ? AND society_id = ?',
      [status, id, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM lost_found WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, updateStatus, remove };
