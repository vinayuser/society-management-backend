const db = require('../config/database');

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
    const [rows] = await db.pool.execute(
      `SELECT f.id, f.society_id, f.tower, f.flat_number, f.floor, f.flat_type, f.area_sqft, f.status,
       r.is_primary
       FROM residents r
       JOIN flats f ON f.id = r.flat_id AND f.society_id = r.society_id
       WHERE r.user_id = ? AND r.society_id = ?
       ORDER BY r.is_primary DESC, f.tower, f.flat_number`,
      [req.user.id, societyId]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
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
    });
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

module.exports = { myFlats, myProfile };
