const db = require('../config/database');

/**
 * For resident users, load their flat IDs from residents table and set req.myFlatIds (array).
 * For non-residents, req.myFlatIds = [].
 * Use after authenticate + scopeToUserSociety.
 */
async function loadResidentFlats(req, res, next) {
  if (req.user?.role !== 'resident') {
    req.myFlatIds = [];
    return next();
  }
  try {
    const [rows] = await db.pool.execute(
      'SELECT flat_id FROM residents WHERE user_id = ? AND society_id = ?',
      [req.user.id, req.user.societyId || req.societyId]
    );
    req.myFlatIds = (rows || []).map((r) => r.flat_id).filter(Boolean);
    next();
  } catch (err) {
    next(err);
  }
}

/** Require that the resident has at least one flat (for app APIs that need a flat). */
function requireResidentFlat(req, res, next) {
  if (req.user?.role !== 'resident') return next();
  if (!req.myFlatIds || !req.myFlatIds.length) {
    return res.status(403).json({ success: false, message: 'No flat assigned to your account' });
  }
  next();
}

module.exports = { loadResidentFlats, requireResidentFlat };
