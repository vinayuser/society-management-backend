const db = require('../config/database');

const ADMIN_ROLES = ['society_admin', 'super_admin'];

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function isAdmin(req) {
  return req.user && ADMIN_ROLES.includes(req.user.role);
}

/** List all chat groups for the society (user must be member or admin) */
async function listGroups(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const userId = req.user.id;
    const [rows] = await db.pool.execute(
      `SELECT g.id, g.society_id, g.name, g.description, g.icon, g.admin_only_posting, g.members_can_delete_own,
              g.created_by, g.created_at, g.updated_at,
              (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id = g.id) AS member_count,
              (SELECT COUNT(*) FROM chat_messages msg WHERE msg.group_id = g.id AND msg.deleted_at IS NULL) AS message_count
       FROM chat_groups g
       INNER JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = ?
       WHERE g.society_id = ?
       ORDER BY g.updated_at DESC`,
      [userId, societyId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        name: r.name,
        description: r.description,
        icon: r.icon,
        adminOnlyPosting: Boolean(r.admin_only_posting),
        membersCanDeleteOwn: Boolean(r.members_can_delete_own),
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        memberCount: r.member_count,
        messageCount: r.message_count,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** Create a new chat group (admin only) */
async function createGroup(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only admins can create groups' });
    }
    const { name, description, icon, adminOnlyPosting, memberIds } = req.body;
    const [insertGroup] = await db.pool.execute(
      `INSERT INTO chat_groups (society_id, name, description, icon, admin_only_posting, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [societyId, name, description || null, icon || null, adminOnlyPosting ? 1 : 0, req.user.id]
    );
    const groupId = insertGroup.insertId;
    const members = [...new Set([req.user.id, ...(memberIds || [])])];
    for (const uid of members) {
      const [u] = await db.pool.execute('SELECT society_id FROM users WHERE id = ? AND society_id = ?', [uid, societyId]);
      if (u.length) {
        await db.pool.execute('INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)', [groupId, uid]);
      }
    }
    const [newGroup] = await db.pool.execute(
      'SELECT id, society_id, name, description, icon, admin_only_posting, members_can_delete_own, created_by, created_at FROM chat_groups WHERE id = ?',
      [groupId]
    );
    res.status(201).json({
      success: true,
      data: {
        id: newGroup[0].id,
        societyId: newGroup[0].society_id,
        name: newGroup[0].name,
        description: newGroup[0].description,
        icon: newGroup[0].icon,
        adminOnlyPosting: Boolean(newGroup[0].admin_only_posting),
        membersCanDeleteOwn: Boolean(newGroup[0].members_can_delete_own),
        createdBy: newGroup[0].created_by,
        createdAt: newGroup[0].created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Get single group (must be member), with member list */
async function getGroup(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const userId = req.user.id;
    const [groups] = await db.pool.execute(
      `SELECT g.* FROM chat_groups g
       INNER JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = ?
       WHERE g.id = ? AND g.society_id = ?`,
      [userId, id, societyId]
    );
    if (!groups.length) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const g = groups[0];
    const [members] = await db.pool.execute(
      `SELECT u.id, u.name, u.email, u.role FROM users u
       INNER JOIN chat_group_members m ON m.user_id = u.id WHERE m.group_id = ?`,
      [id]
    );
    res.json({
      success: true,
      data: {
        id: g.id,
        societyId: g.society_id,
        name: g.name,
        description: g.description,
        icon: g.icon,
        adminOnlyPosting: Boolean(g.admin_only_posting),
        membersCanDeleteOwn: Boolean(g.members_can_delete_own),
        createdBy: g.created_by,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Update group (admin only) */
async function updateGroup(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only admins can update groups' });
    }
    const [existing] = await db.pool.execute('SELECT id FROM chat_groups WHERE id = ? AND society_id = ?', [id, societyId]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const { name, description, icon, adminOnlyPosting, memberIds } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon || null);
    }
    if (adminOnlyPosting !== undefined) {
      updates.push('admin_only_posting = ?');
      params.push(adminOnlyPosting ? 1 : 0);
    }
    if (updates.length) {
      params.push(id);
      await db.pool.execute(`UPDATE chat_groups SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    if (memberIds !== undefined) {
      await db.pool.execute('DELETE FROM chat_group_members WHERE group_id = ?', [id]);
      for (const uid of memberIds) {
        const [u] = await db.pool.execute('SELECT id FROM users WHERE id = ? AND society_id = ?', [uid, societyId]);
        if (u.length) {
          await db.pool.execute('INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)', [id, uid]);
        }
      }
    }
    const [updated] = await db.pool.execute('SELECT * FROM chat_groups WHERE id = ?', [id]);
    res.json({ success: true, data: mapGroupRow(updated[0]) });
  } catch (err) {
    next(err);
  }
}

/** Delete group (admin only) */
async function deleteGroup(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only admins can delete groups' });
    }
    const [result] = await db.pool.execute('DELETE FROM chat_groups WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
}

/** Get messages for a group (paginated), with read counts */
async function getMessages(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const userId = req.user.id;
    const { group_id: groupId, limit, offset } = req.query;
    const [memberCheck] = await db.pool.execute(
      'SELECT 1 FROM chat_group_members m INNER JOIN chat_groups g ON g.id = m.group_id WHERE m.group_id = ? AND m.user_id = ? AND g.society_id = ?',
      [groupId, userId, societyId]
    );
    if (!memberCheck.length) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }
    const [messages] = await db.pool.execute(
      `SELECT m.id, m.group_id, m.society_id, m.user_id, m.message_text, m.message_type, m.media_url, m.is_pinned, m.created_at,
              u.name AS user_name
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.society_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [groupId, societyId, parseInt(limit, 10), parseInt(offset, 10)]
    );
    const messageIds = messages.map((m) => m.id);
    let readCounts = {};
    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(',');
      const [reads] = await db.pool.execute(
        `SELECT message_id, COUNT(*) AS cnt FROM chat_message_reads WHERE message_id IN (${placeholders}) GROUP BY message_id`,
        messageIds
      );
      reads.forEach((r) => {
        readCounts[r.message_id] = r.cnt;
      });
    }
    const [totalRows] = await db.pool.execute(
      'SELECT COUNT(*) AS c FROM chat_messages WHERE group_id = ? AND society_id = ? AND deleted_at IS NULL',
      [groupId, societyId]
    );
    const totalCount = (totalRows && totalRows[0] && totalRows[0].c) || 0;
    res.json({
      success: true,
      data: messages.reverse().map((m) => ({
        id: m.id,
        groupId: m.group_id,
        societyId: m.society_id,
        userId: m.user_id,
        userName: m.user_name,
        messageText: m.message_text,
        messageType: m.message_type,
        mediaUrl: m.media_url,
        isPinned: Boolean(m.is_pinned),
        createdAt: m.created_at,
        readCount: readCounts[m.id] || 0,
      })),
      total: totalCount,
    });
  } catch (err) {
    next(err);
  }
}

/** Send message (POST) - also used by Socket.IO handler to persist */
async function sendMessage(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const userId = req.user.id;
    const { groupId, messageText, messageType, mediaUrl } = req.body;
    const [group] = await db.pool.execute(
      `SELECT g.* FROM chat_groups g
       INNER JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = ?
       WHERE g.id = ? AND g.society_id = ?`,
      [userId, groupId, societyId]
    );
    if (!group.length) {
      return res.status(403).json({ success: false, message: 'Not a member or group not found' });
    }
    const g = group[0];
    if (g.admin_only_posting && !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can post in this group' });
    }
    const [insert] = await db.pool.execute(
      `INSERT INTO chat_messages (group_id, society_id, user_id, message_text, message_type, media_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [groupId, societyId, userId, messageText, messageType || 'text', mediaUrl || null]
    );
    const [newMsg] = await db.pool.execute(
      `SELECT m.id, m.group_id, m.user_id, m.message_text, m.message_type, m.media_url, m.is_pinned, m.created_at, u.name AS user_name
       FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
      [insert.insertId]
    );
    const msg = newMsg[0];
    res.status(201).json({
      success: true,
      data: {
        id: msg.id,
        groupId: msg.group_id,
        userId: msg.user_id,
        userName: msg.user_name,
        messageText: msg.message_text,
        messageType: msg.message_type,
        mediaUrl: msg.media_url,
        isPinned: Boolean(msg.is_pinned),
        createdAt: msg.created_at,
        readCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Mark message as read */
async function markMessageRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { messageId } = req.body;
    const [msg] = await db.pool.execute(
      `SELECT m.id, m.group_id FROM chat_messages m
       INNER JOIN chat_group_members gm ON gm.group_id = m.group_id AND gm.user_id = ?
       WHERE m.id = ? AND m.deleted_at IS NULL`,
      [userId, messageId]
    );
    if (!msg.length) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    await db.pool.execute(
      'INSERT IGNORE INTO chat_message_reads (message_id, user_id) VALUES (?, ?)',
      [messageId, userId]
    );
    const [count] = await db.pool.execute('SELECT COUNT(*) AS c FROM chat_message_reads WHERE message_id = ?', [messageId]);
    res.json({ success: true, data: { messageId, readCount: count[0].c } });
  } catch (err) {
    next(err);
  }
}

/** Delete message (admin can delete any; member only own if members_can_delete_own) */
async function deleteMessage(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const userId = req.user.id;
    const [msg] = await db.pool.execute(
      `SELECT m.id, m.user_id, m.group_id, g.members_can_delete_own
       FROM chat_messages m
       INNER JOIN chat_groups g ON g.id = m.group_id
       INNER JOIN chat_group_members gm ON gm.group_id = m.group_id AND gm.user_id = ?
       WHERE m.id = ? AND m.society_id = ? AND m.deleted_at IS NULL`,
      [userId, id, societyId]
    );
    if (!msg.length) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    const m = msg[0];
    const canDelete =
      isAdmin(req) || (m.user_id === userId && m.members_can_delete_own);
    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Cannot delete this message' });
    }
    await db.pool.execute('UPDATE chat_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
}

/** Pin / unpin message (admin only) */
async function pinMessage(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const { pin } = req.body;
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only admins can pin messages' });
    }
    const [msg] = await db.pool.execute(
      'SELECT id, group_id FROM chat_messages WHERE id = ? AND society_id = ? AND deleted_at IS NULL',
      [id, societyId]
    );
    if (!msg.length) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    const groupId = msg[0].group_id;
    if (pin) {
      await db.pool.execute('UPDATE chat_messages SET is_pinned = 0 WHERE group_id = ?', [groupId]);
    }
    await db.pool.execute('UPDATE chat_messages SET is_pinned = ? WHERE id = ?', [pin ? 1 : 0, id]);
    res.json({ success: true, data: { messageId: parseInt(id, 10), pinned: !!pin } });
  } catch (err) {
    next(err);
  }
}

/** Get society users for group member picker (admin) */
async function getSocietyUsers(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const [rows] = await db.pool.execute(
      'SELECT id, name, email, phone, role FROM users WHERE society_id = ? AND is_active = 1 ORDER BY name',
      [societyId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

function mapGroupRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    societyId: r.society_id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    adminOnlyPosting: Boolean(r.admin_only_posting),
    membersCanDeleteOwn: Boolean(r.members_can_delete_own),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

module.exports = {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  getMessages,
  sendMessage,
  markMessageRead,
  deleteMessage,
  pinMessage,
  getSocietyUsers,
};
