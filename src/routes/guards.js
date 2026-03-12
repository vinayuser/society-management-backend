const express = require('express');
const guardsController = require('../controllers/guardsController');
const guardShiftsController = require('../controllers/guardShiftsController');
const guardLeavesController = require('../controllers/guardLeavesController');
const guardDocumentsController = require('../controllers/guardDocumentsController');
const { authenticate } = require('../middleware/auth');
const { societyAdminOnly } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { uploadProfile, uploadDocument } = require('../middleware/upload');
const { guards: g } = require('../validations');

const router = express.Router();

router.use(authenticate, societyAdminOnly, scopeToUserSociety);

router.get('/', guardsController.list);
router.get('/leaves', guardLeavesController.list);
router.get('/:id', validate(g.idParam, 'params'), guardsController.getOne);
router.post('/', validate(g.create), guardsController.create);
router.post('/:id/profile-picture', validate(g.idParam, 'params'), uploadProfile.single('profile'), guardsController.uploadProfile);
router.patch('/:id', validate(g.idParam, 'params'), validate(g.update), guardsController.update);
router.delete('/:id', validate(g.idParam, 'params'), guardsController.remove);

router.get('/:guardId/shifts', validate(g.guardIdParam, 'params'), guardShiftsController.list);
router.post('/:guardId/shifts', validate(g.guardIdParam, 'params'), validate(g.shiftBody), guardShiftsController.create);
router.patch('/:guardId/shifts/:shiftId', validate(g.shiftIdParam, 'params'), validate(g.shiftUpdate), guardShiftsController.update);
router.delete('/:guardId/shifts/:shiftId', validate(g.shiftIdParam, 'params'), guardShiftsController.remove);

router.get('/:guardId/leaves', validate(g.guardIdParam, 'params'), guardLeavesController.list);
router.post('/:guardId/leaves', validate(g.guardIdParam, 'params'), validate(g.leaveBody), guardLeavesController.create);
router.patch('/:guardId/leaves/:leaveId/status', validate(g.leaveIdParam, 'params'), validate(g.leaveStatusBody), guardLeavesController.updateStatus);
router.delete('/:guardId/leaves/:leaveId', validate(g.leaveIdParam, 'params'), guardLeavesController.remove);

router.get('/:guardId/documents', validate(g.guardIdParam, 'params'), guardDocumentsController.list);
router.post('/:guardId/documents', validate(g.guardIdParam, 'params'), uploadDocument.single('file'), guardDocumentsController.create);
router.delete('/:guardId/documents/:docId', validate(g.docIdParam, 'params'), guardDocumentsController.remove);

module.exports = router;
