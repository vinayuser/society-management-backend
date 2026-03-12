const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

function mapMember(r) {
  return {
    id: r.id,
    societyId: r.society_id,
    flatId: r.flat_id,
    userId: r.user_id,
    name: r.name,
    profileImage: r.profile_image,
    phone: r.phone,
    email: r.email,
    role: r.role,
    gender: r.gender,
    dob: r.dob,
    occupation: r.occupation,
    status: r.status,
    joinedAt: r.joined_at,
    tower: r.tower,
    flatNumber: r.flat_number,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    if (!societyId) return res.status(400).json({ success: false, message: 'Society context required' });
    const { search, role, tower, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let sql = `SELECT m.id, m.society_id, m.flat_id, m.user_id, m.name, m.profile_image, m.phone, m.email, m.role, m.gender, m.dob, m.occupation, m.status, m.joined_at, m.created_at, m.updated_at,
      f.tower, f.flat_number
      FROM members m
      LEFT JOIN flats f ON f.id = m.flat_id AND f.society_id = m.society_id
      WHERE m.society_id = ?`;
    const params = [societyId];

    if (search && String(search).trim()) {
      sql += ' AND (m.name LIKE ? OR m.phone LIKE ? OR m.email LIKE ?)';
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }
    if (role && String(role).trim()) {
      sql += ' AND m.role = ?';
      params.push(String(role).trim());
    }
    if (tower && String(tower).trim()) {
      sql += ' AND f.tower = ?';
      params.push(String(tower).trim());
    }
    if (status && String(status).trim()) {
      sql += ' AND m.status = ?';
      params.push(String(status).trim());
    }

    const countParams = [societyId];
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      countParams.push(term, term, term);
    }
    if (role && String(role).trim()) countParams.push(String(role).trim());
    if (tower && String(tower).trim()) countParams.push(String(tower).trim());
    if (status && String(status).trim()) countParams.push(String(status).trim());

    let countSql = `SELECT COUNT(*) AS total FROM members m LEFT JOIN flats f ON f.id = m.flat_id AND f.society_id = m.society_id WHERE m.society_id = ?`;
    if (search && String(search).trim()) countSql += ' AND (m.name LIKE ? OR m.phone LIKE ? OR m.email LIKE ?)';
    if (role && String(role).trim()) countSql += ' AND m.role = ?';
    if (tower && String(tower).trim()) countSql += ' AND f.tower = ?';
    if (status && String(status).trim()) countSql += ' AND m.status = ?';
    const [countRows] = await db.pool.execute(countSql, countParams);
    const total = countRows[0]?.total ?? 0;

    sql += ` ORDER BY m.name LIMIT ${limitNum} OFFSET ${offset}`;
    const [rows] = await db.pool.execute(sql, params);

    res.json({
      success: true,
      data: rows.map(mapMember),
      pagination: { page: pageNum, limit: limitNum, total },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [rows] = await db.pool.execute(
      `SELECT m.id, m.society_id, m.flat_id, m.user_id, m.name, m.profile_image, m.phone, m.email, m.role, m.gender, m.dob, m.occupation, m.status, m.joined_at, m.created_at, m.updated_at,
       f.tower, f.flat_number
       FROM members m
       LEFT JOIN flats f ON f.id = m.flat_id AND f.society_id = m.society_id
       WHERE m.id = ? AND m.society_id = ?`,
      [id, societyId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: mapMember(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const {
      flatId, userId, name, profileImage, phone, email, role, gender, dob, occupation, status, joinedAt,
    } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO members (society_id, flat_id, user_id, name, profile_image, phone, email, role, gender, dob, occupation, status, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        societyId,
        flatId ?? null,
        userId ?? null,
        name || '',
        profileImage ?? null,
        phone ?? null,
        email ?? null,
        role || 'family_member',
        gender ?? null,
        dob ?? null,
        occupation ?? null,
        status || 'active',
        joinedAt ?? null,
      ]
    );
    const [rows] = await db.pool.execute(
      `SELECT m.id, m.society_id, m.flat_id, m.user_id, m.name, m.profile_image, m.phone, m.email, m.role, m.gender, m.dob, m.occupation, m.status, m.joined_at, m.created_at, m.updated_at,
       f.tower, f.flat_number FROM members m LEFT JOIN flats f ON f.id = m.flat_id AND f.society_id = m.society_id WHERE m.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: mapMember(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const body = req.body || {};
    const allowed = [
      'flatId', 'userId', 'name', 'profileImage', 'phone', 'email', 'role', 'gender', 'dob', 'occupation', 'status', 'joinedAt',
    ];
    const colMap = {
      flatId: 'flat_id', userId: 'user_id', profileImage: 'profile_image', joinedAt: 'joined_at',
    };
    const set = [];
    const params = [];
    for (const k of allowed) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      const col = colMap[k] || k;
      set.push(`${col} = ?`);
      const v = body[k];
      params.push(v === '' || v === null ? null : v);
    }
    if (set.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    set.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, societyId);
    const [result] = await db.pool.execute(
      `UPDATE members SET ${set.join(', ')} WHERE id = ? AND society_id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    const [rows] = await db.pool.execute(
      `SELECT m.id, m.society_id, m.flat_id, m.user_id, m.name, m.profile_image, m.phone, m.email, m.role, m.gender, m.dob, m.occupation, m.status, m.joined_at, m.created_at, m.updated_at,
       f.tower, f.flat_number FROM members m LEFT JOIN flats f ON f.id = m.flat_id AND f.society_id = m.society_id WHERE m.id = ?`,
      [id]
    );
    res.json({ success: true, data: mapMember(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const { id } = req.params;
    const [result] = await db.pool.execute('DELETE FROM members WHERE id = ? AND society_id = ?', [id, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, message: 'Member deleted' });
  } catch (err) {
    next(err);
  }
}

async function listComplaints(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const [member] = await db.pool.execute('SELECT user_id FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!member.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const userId = member[0].user_id;
    if (!userId) return res.json({ success: true, data: [] });
    const [rows] = await db.pool.execute(
      `SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.resolved_at, c.created_at
       FROM complaints c WHERE c.society_id = ? AND c.user_id = ? ORDER BY c.created_at DESC`,
      [societyId, userId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, userId: r.user_id, title: r.title, description: r.description, category: r.category,
        status: r.status, resolvedAt: r.resolved_at, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function listMarketplace(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const [member] = await db.pool.execute('SELECT user_id FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!member.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const userId = member[0].user_id;
    if (!userId) return res.json({ success: true, data: [] });
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, user_id, title, description, price, category, status, created_at
       FROM marketplace_items WHERE society_id = ? AND user_id = ? ORDER BY created_at DESC`,
      [societyId, userId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, userId: r.user_id, title: r.title, description: r.description, price: parseFloat(r.price),
        category: r.category, status: r.status, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function listActivity(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const [member] = await db.pool.execute('SELECT user_id FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!member.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const userId = member[0].user_id;
    const activities = [];
    if (userId) {
      const [complaints] = await db.pool.execute(
        'SELECT id, title, status, created_at FROM complaints WHERE society_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10',
        [societyId, userId]
      );
      complaints.forEach((c) => activities.push({ type: 'complaint', id: c.id, title: c.title, status: c.status, createdAt: c.created_at }));
      const [items] = await db.pool.execute(
        'SELECT id, title, status, created_at FROM marketplace_items WHERE society_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10',
        [societyId, userId]
      );
      items.forEach((i) => activities.push({ type: 'marketplace', id: i.id, title: i.title, status: i.status, createdAt: i.created_at }));
    }
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: activities.slice(0, 20) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, listComplaints, listMarketplace, listActivity };
