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
      'SELECT id, member_id, vehicle_number, vehicle_type, parking_slot, created_at FROM member_vehicles WHERE society_id = ? AND member_id = ? ORDER BY created_at ASC',
      [societyId, memberId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id, memberId: r.member_id, vehicleNumber: r.vehicle_number, vehicleType: r.vehicle_type, parkingSlot: r.parking_slot, createdAt: r.created_at,
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
    const { vehicleNumber, vehicleType, parkingSlot } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [result] = await db.pool.execute(
      'INSERT INTO member_vehicles (society_id, member_id, vehicle_number, vehicle_type, parking_slot) VALUES (?, ?, ?, ?, ?)',
      [societyId, memberId, vehicleNumber || '', vehicleType || 'car', parkingSlot || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId, memberId: Number(memberId), vehicleNumber: vehicleNumber || '', vehicleType: vehicleType || 'car', parkingSlot: parkingSlot || null, createdAt: new Date(),
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
    const vehicleId = req.params.vehicleId;
    const { vehicleNumber, vehicleType, parkingSlot } = req.body;
    const [memberCheck] = await db.pool.execute('SELECT 1 FROM members WHERE id = ? AND society_id = ?', [memberId, societyId]);
    if (!memberCheck.length) return res.status(404).json({ success: false, message: 'Member not found' });
    const [result] = await db.pool.execute(
      'UPDATE member_vehicles SET vehicle_number = COALESCE(?, vehicle_number), vehicle_type = COALESCE(?, vehicle_type), parking_slot = ? WHERE id = ? AND member_id = ? AND society_id = ?',
      [vehicleNumber || undefined, vehicleType || undefined, parkingSlot || null, vehicleId, memberId, societyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const [rows] = await db.pool.execute('SELECT id, member_id, vehicle_number, vehicle_type, parking_slot, created_at FROM member_vehicles WHERE id = ?', [vehicleId]);
    const r = rows[0];
    res.json({
      success: true,
      data: { id: r.id, memberId: r.member_id, vehicleNumber: r.vehicle_number, vehicleType: r.vehicle_type, parkingSlot: r.parking_slot, createdAt: r.created_at },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const memberId = req.params.id;
    const vehicleId = req.params.vehicleId;
    const [result] = await db.pool.execute('DELETE FROM member_vehicles WHERE id = ? AND member_id = ? AND society_id = ?', [vehicleId, memberId, societyId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
