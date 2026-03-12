const db = require('../config/database');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [rows] = await db.pool.execute(
      'SELECT id, society_id, member_id, name, relationship, phone, age, created_at FROM member_family WHERE society_id = ? AND member_id = ? ORDER BY created_at ASC',
      [societyId, memberId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, memberId: r.member_id, name: r.name, relationship: r.relationship, phone: r.phone, age: r.age, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const { name, relationship, phone, age } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const ageVal = age != null && age !== '' ? parseInt(age, 10) : null;
    const [result] = await db.pool.execute(
      'INSERT INTO member_family (society_id, member_id, name, relationship, phone, age) VALUES (?, ?, ?, ?, ?, ?)',
      [societyId, memberId, name || '', relationship ?? null, phone ?? null, ageVal]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId, memberId: Number(memberId), name: name || '', relationship: relationship ?? null, phone: phone ?? null, age: ageVal, createdAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const familyId = req.params.familyId;
    const { name, relationship, phone, age } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const ageVal = age != null && age !== '' ? parseInt(age, 10) : null;
    const [result] = await db.pool.execute(
      'UPDATE member_family SET name = COALESCE(?, name), relationship = ?, phone = ?, age = ? WHERE id = ? AND member_id = ? AND society_id = ?',
      [name ?? undefined, relationship ?? null, phone ?? null, ageVal, familyId, memberId, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Family member not found' });
    const [rows] = await db.pool.execute('SELECT id, member_id, name, relationship, phone, age, created_at FROM member_family WHERE id = ?', [familyId]);
    const r = rows[0];
    res.json({
      success: true,
      data: { id: r.id, memberId: r.member_id, name: r.name, relationship: r.relationship, phone: r.phone, age: r.age, createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const familyId = req.params.familyId;
    const [result] = await db.pool.execute('DELETE FROM member_family WHERE id = ? AND member_id = ? AND society_id = ?', [familyId, memberId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Family member not found' });
    res.json({ success: true, message: 'Family member removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
