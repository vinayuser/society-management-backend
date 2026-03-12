const express = require('express');
const marketplaceController = require('../controllers/marketplaceController');
const marketplaceTransactionsController = require('../controllers/marketplaceTransactionsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { uploadMarketplaceMedia } = require('../middleware/upload');
const { marketplace: m } = require('../validations');

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

const router = express.Router();

router.use(authenticate);

router.get('/global', allowList(['society_admin', 'super_admin']), marketplaceController.listGlobal);

router.use(scopeToUserSociety);

router.get('/', allowList(['society_admin', 'resident', 'super_admin']), marketplaceController.list);
router.get('/transactions', allowList(['society_admin', 'super_admin']), marketplaceTransactionsController.list);
router.post('/transactions', allowList(['society_admin', 'resident', 'super_admin']), validate(m.createTransaction), marketplaceTransactionsController.create);
router.get('/:id', allowList(['society_admin', 'resident', 'super_admin']), validate(m.idParam, 'params'), marketplaceController.getOne);
router.post('/', allowList(['society_admin', 'resident', 'super_admin']), validate(m.create), marketplaceController.create);
router.patch('/:id', allowList(['society_admin', 'resident', 'super_admin']), validate(m.idParam, 'params'), validate(m.update), marketplaceController.update);
router.patch('/:id/status', allowList(['society_admin', 'super_admin']), validate(m.idParam, 'params'), validate(m.updateStatus), marketplaceController.updateStatus);
router.patch('/:id/pin', allowList(['society_admin', 'super_admin']), validate(m.idParam, 'params'), validate(m.pinBody), marketplaceController.pin);
router.patch('/:id/listed-globally', allowList(['society_admin', 'super_admin']), validate(m.idParam, 'params'), validate(m.listedGloballyBody), marketplaceController.setListedGlobally);
router.post('/:id/media', allowList(['society_admin', 'resident', 'super_admin']), validate(m.idParam, 'params'), uploadMarketplaceMedia, marketplaceController.uploadMedia);
router.delete('/:id', allowList(['society_admin', 'super_admin']), validate(m.idParam, 'params'), marketplaceController.remove);

module.exports = router;
