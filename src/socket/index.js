const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

const ADMIN_ROLES = ['society_admin', 'super_admin'];

function getIO(server) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: true },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const [users] = await db.pool.execute(
        'SELECT id, society_id, name, email, role, is_active FROM users WHERE id = ?',
        [decoded.userId]
      );
      if (!users.length || !users[0].is_active) {
        return next(new Error('User not found or inactive'));
      }
      socket.userId = users[0].id;
      socket.societyId = users[0].society_id;
      socket.userName = users[0].name;
      socket.userRole = users[0].role;
      next();
    } catch (err) {
      next(new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-group', async (groupId, cb) => {
      try {
        const [rows] = await db.pool.execute(
          `SELECT g.id, g.society_id FROM chat_groups g
           INNER JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = ?
           WHERE g.id = ? AND g.society_id = ?`,
          [socket.userId, groupId, socket.societyId]
        );
        if (!rows.length) {
          if (typeof cb === 'function') cb({ success: false, message: 'Not a member' });
          return;
        }
        const room = `group:${groupId}`;
        socket.join(room);
        socket.currentGroupId = groupId;
        if (typeof cb === 'function') cb({ success: true });
      } catch (e) {
        if (typeof cb === 'function') cb({ success: false, message: e.message });
      }
    });

    socket.on('leave-group', (groupId) => {
      socket.leave(`group:${groupId}`);
      if (socket.currentGroupId === groupId) socket.currentGroupId = null;
    });

    socket.on('send-message', async (payload, cb) => {
      const { groupId, messageText, messageType, mediaUrl } = payload || {};
      try {
        const [group] = await db.pool.execute(
          `SELECT g.* FROM chat_groups g
           INNER JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = ?
           WHERE g.id = ? AND g.society_id = ?`,
          [socket.userId, groupId, socket.societyId]
        );
        if (!group.length) {
          if (typeof cb === 'function') cb({ success: false, message: 'Not a member' });
          return;
        }
        if (group[0].admin_only_posting && !ADMIN_ROLES.includes(socket.userRole)) {
          if (typeof cb === 'function') cb({ success: false, message: 'Only admins can post' });
          return;
        }
        const [insert] = await db.pool.execute(
          `INSERT INTO chat_messages (group_id, society_id, user_id, message_text, message_type, media_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [groupId, socket.societyId, socket.userId, messageText || '', messageType || 'text', mediaUrl || null]
        );
        const [newMsg] = await db.pool.execute(
          `SELECT m.id, m.group_id, m.user_id, m.message_text, m.message_type, m.media_url, m.is_pinned, m.created_at
           FROM chat_messages m WHERE m.id = ?`,
          [insert.insertId]
        );
        const msg = newMsg[0];
        const data = {
          id: msg.id,
          groupId: msg.group_id,
          userId: msg.user_id,
          userName: socket.userName,
          messageText: msg.message_text,
          messageType: msg.message_type,
          mediaUrl: msg.media_url,
          isPinned: Boolean(msg.is_pinned),
          createdAt: msg.created_at,
          readCount: 0,
        };
        io.to(`group:${groupId}`).emit('receive-message', data);
        if (typeof cb === 'function') cb({ success: true, data });
      } catch (e) {
        if (typeof cb === 'function') cb({ success: false, message: e.message });
      }
    });

    socket.on('message-read', async (payload, cb) => {
      const { messageId } = payload || {};
      try {
        const [msg] = await db.pool.execute(
          `SELECT m.id, m.group_id FROM chat_messages m
           INNER JOIN chat_group_members gm ON gm.group_id = m.group_id AND gm.user_id = ?
           WHERE m.id = ? AND m.deleted_at IS NULL`,
          [socket.userId, messageId]
        );
        if (!msg.length) {
          if (typeof cb === 'function') cb({ success: false });
          return;
        }
        await db.pool.execute(
          'INSERT IGNORE INTO chat_message_reads (message_id, user_id) VALUES (?, ?)',
          [messageId, socket.userId]
        );
        const [count] = await db.pool.execute(
          'SELECT COUNT(*) AS c FROM chat_message_reads WHERE message_id = ?',
          [messageId]
        );
        const readCount = count[0].c;
        io.to(`group:${msg[0].group_id}`).emit('read-receipt', { messageId, userId: socket.userId, readCount });
        if (typeof cb === 'function') cb({ success: true, readCount });
      } catch (e) {
        if (typeof cb === 'function') cb({ success: false });
      }
    });

    socket.on('typing', (groupId) => {
      if (socket.currentGroupId === groupId) {
        socket.to(`group:${groupId}`).emit('user-typing', { userId: socket.userId, userName: socket.userName });
      }
    });

    socket.on('disconnect', () => {
      socket.currentGroupId = null;
    });
  });

  return io;
}

module.exports = { getIO };
