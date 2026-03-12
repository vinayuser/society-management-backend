const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });

    // 1) Directory members (members table) – members added from the Members module with this flat_id
    const [dirRows] = await db.pool.execute(
      'SELECT id, society_id, flat_id, user_id, name, phone, email, role, profile_image, status, created_at FROM members WHERE society_id = ? AND flat_id = ? ORDER BY name',
      [societyId, flatId]
    );
    const directoryMembers = dirRows.map((r) => ({
      id: 'dir-' + r.id,
      memberId: r.id,
      flatId: r.flat_id,
      userId: r.user_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: r.role,
      profileImage: r.profile_image,
      status: r.status,
      createdAt: r.created_at,
      source: 'directory',
    }));

    // 2) Flat members (flat_members table) – quick-add from the Flat page
    const [fmRows] = await db.pool.execute(
      'SELECT id, society_id, flat_id, user_id, name, phone, email, role, profile_image, created_at FROM flat_members WHERE society_id = ? AND flat_id = ? ORDER BY created_at ASC',
      [societyId, flatId]
    );
    const flatMembers = fmRows.map((r) => ({
      id: r.id,
      memberId: null,
      flatId: r.flat_id,
      userId: r.user_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: r.role,
      profileImage: r.profile_image,
      status: null,
      createdAt: r.created_at,
      source: 'flat',
    }));

    // Combined: directory first, then flat members
    res.json({
      success: true,
      data: [...directoryMembers, ...flatMembers],
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const { name, phone, email, role, userId } = req.body;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO flat_members (society_id, flat_id, user_id, name, phone, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [societyId, flatId, userId || null, name || '', phone || null, email || null, role || 'family_member']
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        flatId: Number(flatId),
        userId: userId || null,
        name: name || '',
        phone: phone || null,
        email: email || null,
        role: role || 'family_member',
        profileImage: null,
        createdAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const memberId = req.params.memberId;
    const { name, phone, email, role } = req.body;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) return res.status(404).json({ success: false, message: 'Flat not found' });
    const [result] = await db.pool.execute(
      'UPDATE flat_members SET name = COALESCE(?, name), phone = ?, email = ?, role = COALESCE(?, role), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND flat_id = ? AND society_id = ?',
      [name ?? undefined, phone ?? null, email ?? null, role ?? undefined, memberId, flatId, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    const [rows] = await db.pool.execute('SELECT id, flat_id, user_id, name, phone, email, role, profile_image, created_at FROM flat_members WHERE id = ?', [memberId]);
    const r = rows[0];
    res.json({
      success: true,
      data: { id: r.id, flatId: r.flat_id, userId: r.user_id, name: r.name, phone: r.phone, email: r.email, role: r.role, profileImage: r.profile_image, createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const memberId = req.params.memberId;
    const [result] = await db.pool.execute('DELETE FROM flat_members WHERE id = ? AND flat_id = ? AND society_id = ?', [memberId, flatId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
