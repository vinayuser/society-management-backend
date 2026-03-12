const express = require('express');
const flatsController = require('../controllers/flatsController');
const flatMembersController = require('../controllers/flatMembersController');
const flatVehiclesController = require('../controllers/flatVehiclesController');
const flatDocumentsController = require('../controllers/flatDocumentsController');
const { authenticate } = require('../middleware/auth');
const { adminOrSocietyAdmin } = require('../middleware/authorize');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { uploadFlatDocument } = require('../middleware/upload');
const { flats: f } = require('../validations');

const router = express.Router();

router.use(authenticate, adminOrSocietyAdmin, scopeToUserSociety);

router.get('/', flatsController.list);
router.post('/', validate(f.create), flatsController.create);
router.post('/bulk', validate(f.bulkCreate), flatsController.bulkCreate);
router.get('/:id', validate(f.idParam, 'params'), flatsController.getOne);
router.put('/:id', validate(f.idParam, 'params'), validate(f.update), flatsController.update);
router.delete('/:id', validate(f.idParam, 'params'), flatsController.remove);

router.get('/:id/members', validate(f.idParam, 'params'), flatMembersController.list);
router.post('/:id/members', validate(f.idParam, 'params'), validate(f.memberBody), flatMembersController.create);
router.put('/:id/members/:memberId', validate(f.memberIdParam, 'params'), validate(f.memberUpdateBody), flatMembersController.update);
router.delete('/:id/members/:memberId', validate(f.memberIdParam, 'params'), flatMembersController.remove);

router.get('/:id/vehicles', validate(f.idParam, 'params'), flatVehiclesController.list);
router.post('/:id/vehicles', validate(f.idParam, 'params'), validate(f.vehicleBody), flatVehiclesController.create);
router.put('/:id/vehicles/:vehicleId', validate(f.vehicleIdParam, 'params'), validate(f.vehicleUpdateBody), flatVehiclesController.update);
router.delete('/:id/vehicles/:vehicleId', validate(f.vehicleIdParam, 'params'), flatVehiclesController.remove);

router.get('/:id/documents', validate(f.idParam, 'params'), flatDocumentsController.list);
router.post('/:id/documents', validate(f.idParam, 'params'), uploadFlatDocument, flatDocumentsController.create);
router.delete('/:id/documents/:docId', validate(f.docIdParam, 'params'), flatDocumentsController.remove);

router.get('/:id/complaints', validate(f.idParam, 'params'), flatsController.listComplaints);
router.get('/:id/billing', validate(f.idParam, 'params'), flatsController.listBilling);

module.exports = router;
