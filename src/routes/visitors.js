const express = require('express');
const visitorsController = require('../controllers/visitorsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { loadResidentFlats } = require('../middleware/residentContext');
const { validate } = require('../middleware/validate');
const { visitors: v } = require('../validations');

const router = express.Router();

const guardOnlyList = ['society_admin', 'security_guard', 'super_admin'];
const listAllowed = ['society_admin', 'security_guard', 'super_admin', 'resident'];
const entryAllowed = ['society_admin', 'security_guard', 'super_admin', 'resident'];
const exitAllowed = ['society_admin', 'security_guard', 'super_admin'];

const guardVisitor = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

router.use(authenticate, scopeToUserSociety, loadResidentFlats);

router.get('/', guardVisitor(listAllowed), visitorsController.list);
router.post('/entry', guardVisitor(entryAllowed), validate(v.entry), visitorsController.entry);
router.post('/:id/exit', guardVisitor(exitAllowed), validate(v.idParam, 'params'), visitorsController.exit);

module.exports = router;
