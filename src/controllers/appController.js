const db = require('../config/database');
const { normalizePageLimit, jsonCollection } = require('../utils/apiResponse');

/**
 * App APIs for residents / flat owners / society members (member-facing application).
 */

async function myFlats(req, res, next) {
  try {
    if (req.user.role !== 'resident') {
      return res.status(403).json({ success: false, message: 'Residents only' });
    }
    const societyId = req.user.societyId || req.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const { page, limit, offset } = normalizePageLimit(req.query, { defaultLimit: 20, maxLimit: 50 });
    const [[{ total }]] = await db.pool.execute(
      'SELECT COUNT(*) AS total FROM residents r WHERE r.user_id = ? AND r.society_id = ?',
      [req.user.id, societyId]
    );
    const [rows] = await db.pool.execute(
      `SELECT f.id, f.society_id, f.tower, f.flat_number, f.floor, f.flat_type, f.area_sqft, f.status,
       r.is_primary
       FROM residents r
       JOIN flats f ON f.id = r.flat_id AND f.society_id = r.society_id
       WHERE r.user_id = ? AND r.society_id = ?
       ORDER BY r.is_primary DESC, f.tower, f.flat_number LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id, societyId]
    );
    jsonCollection(
      res,
      rows.map((r) => ({
        id: r.id,
        societyId: r.society_id,
        tower: r.tower,
        flatNumber: r.flat_number,
        floor: r.floor,
        flatType: r.flat_type,
        areaSqft: r.area_sqft != null ? parseFloat(r.area_sqft) : null,
        status: r.status,
        isPrimary: !!r.is_primary,
      })),
      { page, limit, total: total ?? 0 }
    );
  } catch (err) {
    next(err);
  }
}

async function myProfile(req, res, next) {
  try {
    const [users] = await db.pool.execute(
      `SELECT u.id, u.society_id, u.name, u.email, u.phone, u.role, u.email_verified, u.phone_verified,
       s.name as society_name, s.alias as society_alias
       FROM users u
       LEFT JOIN societies s ON s.id = u.society_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = users[0];
    let myFlatsList = [];
    if (req.user.role === 'resident' && (req.user.societyId || u.society_id)) {
      const [flats] = await db.pool.execute(
        `SELECT f.id, f.tower, f.flat_number, r.is_primary
         FROM residents r
         JOIN flats f ON f.id = r.flat_id AND f.society_id = r.society_id
         WHERE r.user_id = ? AND r.society_id = ?`,
        [req.user.id, u.society_id]
      );
      myFlatsList = flats.map((f) => ({ id: f.id, tower: f.tower, flatNumber: f.flat_number, isPrimary: !!f.is_primary }));
    }
    res.json({
      success: true,
      data: {
        id: u.id,
        societyId: u.society_id,
        societyName: u.society_name,
        societyAlias: u.society_alias,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        emailVerified: !!u.email_verified,
        phoneVerified: !!u.phone_verified,
        flats: myFlatsList,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Office / society contact for the member app (no other members' private data).
 */
async function directory(req, res, next) {
  try {
    if (req.user.role !== 'resident') {
      return res.status(403).json({ success: false, message: 'This directory is for society members' });
    }
    const societyId = req.user.societyId || req.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Society context required' });
    }
    const [rows] = await db.pool.execute(
      `SELECT s.name, s.phone, s.email, c.address, c.admin_contact_name, c.admin_contact_phone
       FROM societies s
       LEFT JOIN society_config c ON c.society_id = s.id
       WHERE s.id = ?`,
      [societyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Society not found' });
    }
    const r = rows[0];
    res.json({
      success: true,
      data: {
        societyName: r.name,
        societyPhone: r.phone,
        societyEmail: r.email,
        officeAddress: r.address,
        officeContactName: r.admin_contact_name,
        officeContactPhone: r.admin_contact_phone,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Recent visitors and deliveries for the signed-in member's flat(s) only.
 */
async function activityFeed(req, res, next) {
  try {
    if (req.user.role !== 'resident') {
      return res.status(403).json({ success: false, message: 'This feed is for society members' });
    }
    const societyId = req.user.societyId || req.societyId;
    if (!societyId || !req.myFlatIds || !req.myFlatIds.length) {
      return res.json({ success: true, data: { items: [] } });
    }
    const ph = req.myFlatIds.map(() => '?').join(',');
    const paramsBase = [societyId, ...req.myFlatIds];
    const [visitorRows] = await db.pool.execute(
      `SELECT v.id, v.entry_time, v.visitor_name, v.visitor_phone, v.purpose, v.exit_time, v.visitor_type,
       f.tower, f.flat_number
       FROM visitors v
       JOIN flats f ON f.id = v.flat_id AND f.society_id = v.society_id
       WHERE v.society_id = ? AND v.flat_id IN (${ph}) AND v.entry_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY v.entry_time DESC LIMIT 25`,
      paramsBase
    );
    const [deliveryRows] = await db.pool.execute(
      `SELECT d.id, d.received_at, d.delivery_type, d.status, d.collected_at,
       f.tower, f.flat_number
       FROM deliveries d
       JOIN flats f ON f.id = d.flat_id AND f.society_id = d.society_id
       WHERE d.society_id = ? AND d.flat_id IN (${ph}) AND d.received_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ORDER BY d.received_at DESC LIMIT 25`,
      paramsBase
    );
    const flatLabel = (t, n) => [t, n].filter(Boolean).join('-') || 'Flat';
    const items = [];
    visitorRows.forEach((v) => {
      items.push({
        kind: 'visitor',
        id: v.id,
        atTime: v.entry_time,
        title: v.visitor_name || 'Visitor',
        subtitle: (v.purpose || v.visitor_type || 'Visit') + ' · ' + flatLabel(v.tower, v.flat_number),
        detail: v.exit_time ? 'Exited' : 'At gate / inside',
        phone: v.visitor_phone || null,
      });
    });
    deliveryRows.forEach((d) => {
      items.push({
        kind: 'delivery',
        id: d.id,
        atTime: d.received_at,
        title: d.delivery_type || 'Delivery',
        subtitle: flatLabel(d.tower, d.flat_number),
        detail: d.status === 'collected' ? 'Collected' : 'At gate / pending pickup',
        phone: null,
      });
    });
    items.sort((a, b) => new Date(b.atTime) - new Date(a.atTime));
    res.json({ success: true, data: { items: items.slice(0, 40) } });
  } catch (err) {
    next(err);
  }
}

module.exports = { myFlats, myProfile, directory, activityFeed };
