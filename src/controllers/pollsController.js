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
      'SELECT COUNT(*) AS total FROM polls WHERE society_id = ?',
      [societyId]
    );
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, title, description, created_by, created_at
       FROM polls WHERE society_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
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
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        title: r.title,
        description: r.description,
        createdBy: r.created_by,
        createdAt: r.created_at,
        options: optionsMap[r.id] || [],
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

async function getOne(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const [polls] = await db.pool.execute(
      'SELECT id, society_id, title, description, created_by, created_at FROM polls WHERE id = ? AND society_id = ?',
      [id, societyId]
    );
    if (!polls.length) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }
    const p = polls[0];
    const [opts] = await db.pool.execute(
      'SELECT id, poll_id, option_label, sort_order FROM poll_options WHERE poll_id = ? ORDER BY sort_order',
      [id]
    );
    const optionIds = opts.map((o) => o.id);
    let voteCounts = {};
    if (optionIds.length) {
      const ph = optionIds.map(() => '?').join(',');
      const [counts] = await db.pool.execute(
        `SELECT option_id, COUNT(*) AS cnt FROM poll_votes WHERE poll_id = ? AND option_id IN (${ph}) GROUP BY option_id`,
        [id, ...optionIds]
      );
      counts.forEach((c) => {
        voteCounts[c.option_id] = c.cnt;
      });
    }
    let myOptionId = null;
    if (req.user?.id) {
      const [mine] = await db.pool.execute(
        'SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ? LIMIT 1',
        [id, req.user.id]
      );
      if (mine.length) myOptionId = mine[0].option_id;
    }
    res.json({
      success: true,
      data: {
        id: p.id,
        societyId: p.society_id,
        title: p.title,
        description: p.description,
        createdBy: p.created_by,
        createdAt: p.created_at,
        myOptionId,
        options: opts.map((o) => ({
          id: o.id,
          optionLabel: o.option_label,
          sortOrder: o.sort_order,
          voteCount: voteCounts[o.id] || 0,
        })),
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

module.exports = { list, getOne, create, remove, vote };
