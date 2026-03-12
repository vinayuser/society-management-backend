const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = req.query.societyId || getSocietyId(req);
    let sql = 'SELECT id, society_id, type, content_url, title, start_date, end_date, is_active, created_at FROM ads WHERE 1=1';
    const params = [];
    if (societyId) {
      sql += ' AND society_id = ?';
      params.push(societyId);
    }
    sql += ' ORDER BY start_date DESC';
    const [rows] = await db.pool.execute(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        type: r.type,
        contentUrl: r.content_url,
        title: r.title,
        startDate: r.start_date,
        endDate: r.end_date,
        isActive: !!r.is_active,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req) || req.body.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { type, contentUrl, title, startDate, endDate } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO ads (society_id, type, content_url, title, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
      [societyId, type || 'banner', contentUrl, title || null, startDate, endDate]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        societyId,
        type: type || 'banner',
        contentUrl,
        title,
        startDate,
        endDate,
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
    const sql = societyId
      ? 'DELETE FROM ads WHERE id = ? AND society_id = ?'
      : 'DELETE FROM ads WHERE id = ?';
    const params = societyId ? [id, societyId] : [id];
    const [result] = await db.pool.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    res.json({ success: true, message: 'Ad deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
