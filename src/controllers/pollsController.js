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
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, title, description, created_by, created_at
       FROM polls WHERE society_id = ? ORDER BY created_at DESC`,
      [societyId]
    );
    const pollIds = rows.map((r) => r.id);
    let optionsMap = {};
    if (pollIds.length) {
      const placeholders = pollIds.map(() => '?').join(',');
      const [opts] = await db.pool.execute(
        'SELECT id, poll_id, option_label, sort_order FROM poll_options WHERE poll_id IN (' + placeholders + ') ORDER BY poll_id, sort_order',
        pollIds
      );
      opts.forEach((o) => {
        if (!optionsMap[o.poll_id]) optionsMap[o.poll_id] = [];
        optionsMap[o.poll_id].push({ id: o.id, optionLabel: o.option_label, sortOrder: o.sort_order });
      });
    }
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        title: r.title,
        description: r.description,
        createdBy: r.created_by,
        createdAt: r.created_at,
        options: optionsMap[r.id] || [],
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
    const { title, description, options } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        'INSERT INTO polls (society_id, title, description, created_by) VALUES (?, ?, ?, ?)',
        [societyId, title, description || null, userId]
      );
      const pollId = result.insertId;
      if (Array.isArray(options) && options.length) {
        for (let i = 0; i < options.length; i++) {
          await conn.execute(
            'INSERT INTO poll_options (poll_id, option_label, sort_order) VALUES (?, ?, ?)',
            [pollId, options[i], i]
          );
        }
      }
      await conn.commit();
      res.status(201).json({
        success: true,
        data: { id: pollId, societyId, title, description: description || null, options: options || [] },
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM polls WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }
    res.json({ success: true, message: 'Poll deleted' });
  } catch (err) {
    next(err);
  }
}

async function vote(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { id } = req.params;
    const { optionId } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE option_id = VALUES(option_id)',
      [id, userId, optionId]
    );
    res.json({ success: true, message: 'Vote recorded' });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'Invalid poll or option' });
    }
    next(err);
  }
}

module.exports = { list, create, remove, vote };
