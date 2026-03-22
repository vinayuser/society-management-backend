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
      'SELECT COUNT(*) AS total FROM notices WHERE society_id = ?',
      [societyId]
    );
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, title, message, scheduled_at, published_at, created_by, created_at
       FROM notices WHERE society_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [societyId]
    );
    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      scheduledAt: r.scheduled_at,
      publishedAt: r.published_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
    jsonCollection(res, data, { page, limit, total: total ?? 0 });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const createdBy = req.user?.id || null;
    const { title, message, scheduledAt } = req.body;
    const publishedAt = !scheduledAt || new Date(scheduledAt) <= new Date() ? new Date() : null;
    const [result] = await db.pool.execute(
      `INSERT INTO notices (society_id, title, message, scheduled_at, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [societyId, title, message, scheduledAt || null, publishedAt, createdBy]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        title,
        message,
        scheduledAt: scheduledAt || null,
        publishedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM notices WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
