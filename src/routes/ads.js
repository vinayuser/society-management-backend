const express = require('express');
const adsController = require('../controllers/adsController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { uploadAdMedia, uploadAdOptionalFile } = require('../middleware/upload');
const { ads: a } = require('../validations');

const router = express.Router();

const allowList = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

function setAdsPlatformUpload(req, res, next) {
  req.adsUploadSegment = 'platform';
  next();
}

function multerAdsError(err, req, res, next) {
  if (!err) return next();
  const msg = err.message || 'Upload failed';
  return res.status(400).json({ success: false, message: msg });
}

router.use(authenticate);

router.get(
  '/',
  allowList(['super_admin', 'society_admin', 'resident']),
  (req, res, next) => {
    const visibleOnly = String(req.query.visibleOnly) === '1' || String(req.query.visibleOnly).toLowerCase() === 'true';
    if (req.user.role === 'super_admin' || visibleOnly) return next();
    scopeToUserSociety(req, res, next);
  },
  adsController.list
);

router.post(
  '/upload-media',
  allowList(['super_admin']),
  setAdsPlatformUpload,
  uploadAdMedia,
  multerAdsError,
  adsController.uploadMedia
);

router.post(
  '/',
  allowList(['super_admin']),
  setAdsPlatformUpload,
  uploadAdOptionalFile,
  multerAdsError,
  adsController.create
);

router.patch(
  '/:id',
  allowList(['super_admin']),
  validate(a.idParam, 'params'),
  setAdsPlatformUpload,
  uploadAdOptionalFile,
  multerAdsError,
  adsController.update
);

router.delete(
  '/:id',
  allowList(['super_admin']),
  validate(a.idParam, 'params'),
  adsController.remove
);

module.exports = router;
