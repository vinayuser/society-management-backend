const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

/** List notifications for the current user (platform-wide: user_id + type). Title and body contain full detail. */
async function list(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query);
    const [[{ total }]] = await db.pool.execute(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
      [userId]
    );
    const [[{ unreadTotal }]] = await db.pool.execute(
      'SELECT COUNT(*) AS unreadTotal FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );
    const [rows] = await db.pool.execute(
      `SELECT id, user_id, type, title, body, reference_id, created_at, read_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );
    const data = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      title: r.title || '',
      body: r.body || '',
      referenceId: r.reference_id,
      createdAt: r.created_at,
      readAt: r.read_at,
    }));
    jsonCollection(res, data, { page, limit, total: total ?? 0 }, { unreadCount: unreadTotal ?? 0 });
  } catch (err) {
    next(err);
  }
}

/** Mark one notification as read (must belong to current user) */
async function markRead(req, res, next) {
  try {
    const id = req.params.id;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const [r] = await db.pool.execute(
      'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: { message: 'Marked as read' } });
  } catch (err) {
    next(err);
  }
}

/** Mark all notifications as read for current user */
async function markAllRead(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    await db.pool.execute(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );
    res.json({ success: true, data: { message: 'All marked as read' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markRead, markAllRead };
