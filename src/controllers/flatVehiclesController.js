const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

function getSocietyId(req) {
  return req.societyId || req.user?.societyId;
}

async function list(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query);
    const [[{ total }]] = await db.pool.execute(
      'SELECT COUNT(*) AS total FROM flat_vehicles WHERE society_id = ? AND flat_id = ?',
      [societyId, flatId]
    );
    const [rows] = await db.pool.execute(
      `SELECT id, society_id, flat_id, vehicle_number, vehicle_type, parking_slot, created_at
       FROM flat_vehicles WHERE society_id = ? AND flat_id = ? ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`,
      [societyId, flatId]
    );
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        flatId: r.flat_id,
        vehicleNumber: r.vehicle_number,
        vehicleType: r.vehicle_type,
        parkingSlot: r.parking_slot,
        createdAt: r.created_at,
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
    const flatId = req.params.id;
    const { vehicleNumber, vehicleType, parkingSlot } = req.body;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const [result] = await db.pool.execute(
      `INSERT INTO flat_vehicles (society_id, flat_id, vehicle_number, vehicle_type, parking_slot)
       VALUES (?, ?, ?, ?, ?)`,
      [societyId, flatId, vehicleNumber || '', vehicleType || 'car', parkingSlot || null]
    );
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        flatId: Number(flatId),
        vehicleNumber: vehicleNumber || '',
        vehicleType: vehicleType || 'car',
        parkingSlot: parkingSlot || null,
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
    const vehicleId = req.params.vehicleId;
    const { vehicleNumber, vehicleType, parkingSlot } = req.body;
    const [flatCheck] = await db.pool.execute('SELECT 1 FROM flats WHERE id = ? AND society_id = ?', [flatId, societyId]);
    if (!flatCheck.length) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }
    const [result] = await db.pool.execute(
      `UPDATE flat_vehicles SET vehicle_number = COALESCE(?, vehicle_number), vehicle_type = COALESCE(?, vehicle_type), parking_slot = ?
       WHERE id = ? AND flat_id = ? AND society_id = ?`,
      [vehicleNumber ?? undefined, vehicleType ?? undefined, parkingSlot ?? null, vehicleId, flatId, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    const [rows] = await db.pool.execute(
      'SELECT id, flat_id, vehicle_number, vehicle_type, parking_slot, created_at FROM flat_vehicles WHERE id = ?',
      [vehicleId]
    );
    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        flatId: r.flat_id,
        vehicleNumber: r.vehicle_number,
        vehicleType: r.vehicle_type,
        parkingSlot: r.parking_slot,
        createdAt: r.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const societyId = getSocietyId(req);
    const flatId = req.params.id;
    const vehicleId = req.params.vehicleId;
    const [result] = await db.pool.execute(
      'DELETE FROM flat_vehicles WHERE id = ? AND flat_id = ? AND society_id = ?',
      [vehicleId, flatId, societyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
