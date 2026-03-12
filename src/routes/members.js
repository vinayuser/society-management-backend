const express = require('express');
const membersController = require('../controllers/membersController');
const memberFamilyController = require('../controllers/memberFamilyController');
const memberVehiclesController = require('../controllers/memberVehiclesController');
const memberDocumentsController = require('../controllers/memberDocumentsController');
const memberEmergencyController = require('../controllers/memberEmergencyController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { uploadMemberDocument } = require('../middleware/upload');
const { members: m } = require('../validations');

const router = express.Router();

router.use(authenticate, adminOrSocietyAdmin, scopeToUserSociety);

router.get('/', membersController.list);
router.post('/', validate(m.create), membersController.create);
router.get('/:id', validate(m.idParam, 'params'), membersController.getOne);
router.put('/:id', validate(m.idParam, 'params'), validate(m.update), membersController.update);
router.delete('/:id', validate(m.idParam, 'params'), membersController.remove);

router.get('/:id/family', validate(m.idParam, 'params'), memberFamilyController.list);
router.post('/:id/family', validate(m.idParam, 'params'), validate(m.familyBody), memberFamilyController.create);
router.put('/:id/family/:familyId', validate(m.familyIdParam, 'params'), validate(m.familyUpdateBody), memberFamilyController.update);
router.delete('/:id/family/:familyId', validate(m.familyIdParam, 'params'), memberFamilyController.remove);

router.get('/:id/vehicles', validate(m.idParam, 'params'), memberVehiclesController.list);
router.post('/:id/vehicles', validate(m.idParam, 'params'), validate(m.vehicleBody), memberVehiclesController.create);
router.put('/:id/vehicles/:vehicleId', validate(m.vehicleIdParam, 'params'), validate(m.vehicleUpdateBody), memberVehiclesController.update);
router.delete('/:id/vehicles/:vehicleId', validate(m.vehicleIdParam, 'params'), memberVehiclesController.remove);

router.get('/:id/documents', validate(m.idParam, 'params'), memberDocumentsController.list);
router.post('/:id/documents', validate(m.idParam, 'params'), uploadMemberDocument, memberDocumentsController.create);
router.delete('/:id/documents/:docId', validate(m.docIdParam, 'params'), memberDocumentsController.remove);

router.get('/:id/emergency', validate(m.idParam, 'params'), memberEmergencyController.list);
router.post('/:id/emergency', validate(m.idParam, 'params'), validate(m.emergencyBody), memberEmergencyController.create);
router.put('/:id/emergency/:contactId', validate(m.contactIdParam, 'params'), validate(m.emergencyUpdateBody), memberEmergencyController.update);
router.delete('/:id/emergency/:contactId', validate(m.contactIdParam, 'params'), memberEmergencyController.remove);

router.get('/:id/complaints', validate(m.idParam, 'params'), membersController.listComplaints);
router.get('/:id/marketplace', validate(m.idParam, 'params'), membersController.listMarketplace);
router.get('/:id/activity', validate(m.idParam, 'params'), membersController.listActivity);

module.exports = router;
