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
      'SELECT id, society_id, member_id, contact_name, relationship, phone, created_at FROM member_emergency_contacts WHERE society_id = ? AND member_id = ? ORDER BY created_at ASC',
      [societyId, memberId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, memberId: r.member_id, contactName: r.contact_name, relationship: r.relationship, phone: r.phone, createdAt: r.created_at,
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
    const { contactName, relationship, phone } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO member_emergency_contacts (society_id, member_id, contact_name, relationship, phone) VALUES (?, ?, ?, ?, ?)',
      [societyId, memberId, contactName || '', relationship ?? null, phone || '']
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId, memberId: Number(memberId), contactName: contactName || '', relationship: relationship ?? null, phone: phone || '', createdAt: new Date(),
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
    const contactId = req.params.contactId;
    const { contactName, relationship, phone } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [result] = await db.pool.execute(
      'UPDATE member_emergency_contacts SET contact_name = COALESCE(?, contact_name), relationship = ?, phone = COALESCE(?, phone) WHERE id = ? AND member_id = ? AND society_id = ?',
      [contactName ?? undefined, relationship ?? null, phone ?? undefined, contactId, memberId, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    const [rows] = await db.pool.execute('SELECT id, member_id, contact_name, relationship, phone, created_at FROM member_emergency_contacts WHERE id = ?', [contactId]);
    const r = rows[0];
    res.json({
      success: true,
      data: { id: r.id, memberId: r.member_id, contactName: r.contact_name, relationship: r.relationship, phone: r.phone, createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const contactId = req.params.contactId;
    const [result] = await db.pool.execute('DELETE FROM member_emergency_contacts WHERE id = ? AND member_id = ? AND society_id = ?', [contactId, memberId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    res.json({ success: true, message: 'Emergency contact removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
