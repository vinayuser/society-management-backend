const config = require('../config');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

const superAdminOnly = authorize(config.roles.SUPER_ADMIN);
const societyAdminOnly = authorize(config.roles.SOCIETY_ADMIN);
const residentOnly = authorize(config.roles.RESIDENT);
const guardOnly = authorize(config.roles.SECURITY_GUARD);
const societyStaff = authorize(config.roles.SOCIETY_ADMIN, config.roles.SECURITY_GUARD);
const adminOrSocietyAdmin = authorize(config.roles.SUPER_ADMIN, config.roles.SOCIETY_ADMIN);

module.exports = {
  authorize,
  superAdminOnly,
  societyAdminOnly,
  residentOnly,
  guardOnly,
  societyStaff,
  adminOrSocietyAdmin,
};
