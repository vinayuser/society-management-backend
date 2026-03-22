const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_BASE = path.join(__dirname, '../../uploads');
try {
  fs.mkdirSync(UPLOAD_BASE, { recursive: true });
} catch (e) {
  if (e.code !== 'EEXIST') throw e;
}

function getGuardUploadDir(societyId, sub = 'profile') {
  const dir = path.join(UPLOAD_BASE, 'guards', String(societyId || '0'), sub);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

const profileStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = getGuardUploadDir(req.societyId, 'profile');
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    const safe = `${req.params.id || 'new'}_${Date.now()}${ext}`;
    cb(null, safe);
  },
});

const documentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = getGuardUploadDir(req.societyId, 'documents');
    cb(null, dir);
  },
  filename(req, file, cb) {
    const base = (file.originalname && path.basename(file.originalname).replace(/\s+/g, '_')) || 'document';
    const ext = path.extname(base) || '';
    const name = ext ? base : base + '.bin';
    cb(null, `${Date.now()}_${name}`);
  },
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^image\/(jpeg|png|gif|webp)$/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed for profile picture'));
  },
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image|application\/pdf)/;
    if (allowed.test(file.mimetype) || file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(new Error('Only images and PDFs are allowed for documents'));
  },
});

function getRelativeUrl(societyId, sub, filename) {
  return `/uploads/guards/${societyId}/${sub}/${filename}`;
}

function getMarketplaceUploadDir(societyId) {
  const dir = path.join(UPLOAD_BASE, 'marketplace', String(societyId || '0'));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function marketplaceFileUrl(societyId, filename) {
  return `/uploads/marketplace/${societyId}/${filename}`;
}

const marketplaceStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getMarketplaceUploadDir(req.societyId));
  },
  filename(req, file, cb) {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    cb(null, `${Date.now()}_${(file.originalname || 'file').replace(/\s+/g, '_').slice(-20)}${ext}`);
  },
});

const uploadMarketplaceMedia = multer({
  storage: marketplaceStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm))$/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM) allowed'));
  },
}).array('media', 10);

function getFlatDocumentDir(societyId) {
  const dir = path.join(UPLOAD_BASE, 'flats', String(societyId || '0'), 'documents');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function getFlatDocumentRelativeUrl(societyId, filename) {
  return `/uploads/flats/${societyId}/documents/${filename}`;
}

const flatDocumentStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getFlatDocumentDir(req.societyId));
  },
  filename(req, file, cb) {
    const base = (file.originalname && path.basename(file.originalname).replace(/\s+/g, '_')) || 'document';
    const ext = path.extname(base) || '';
    const name = ext ? base : base + '.bin';
    cb(null, `${Date.now()}_${name}`);
  },
});

const uploadFlatDocument = multer({
  storage: flatDocumentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image|application\/pdf)/;
    if (allowed.test(file.mimetype) || file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(new Error('Only images and PDFs are allowed for flat documents'));
  },
}).single('file');

function getMemberDocumentDir(societyId) {
  const dir = path.join(UPLOAD_BASE, 'members', String(societyId || '0'), 'documents');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function getMemberDocumentRelativeUrl(societyId, filename) {
  return `/uploads/members/${societyId}/documents/${filename}`;
}

const memberDocumentStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getMemberDocumentDir(req.societyId));
  },
  filename(req, file, cb) {
    const base = (file.originalname && path.basename(file.originalname).replace(/\s+/g, '_')) || 'document';
    const ext = path.extname(base) || '';
    const name = ext ? base : base + '.bin';
    cb(null, `${Date.now()}_${name}`);
  },
});

const uploadMemberDocument = multer({
  storage: memberDocumentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image|application\/pdf)/;
    if (allowed.test(file.mimetype) || file.mimetype === 'application/octet-stream') return cb(null, true);
    cb(new Error('Only images and PDFs are allowed for member documents'));
  },
}).single('file');

function getOnboardingLogoDir(token) {
  const dir = path.join(UPLOAD_BASE, 'onboarding-logos', String((token || '').replace(/[^a-zA-Z0-9]/g, '_')));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function getOnboardingLogoRelativeUrl(token, filename) {
  return `/uploads/onboarding-logos/${String((token || '').replace(/[^a-zA-Z0-9]/g, '_'))}/${filename}`;
}

const onboardingLogoStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getOnboardingLogoDir(req.params.token));
  },
  filename(req, file, cb) {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    cb(null, `logo_${Date.now()}${ext}`);
  },
});

const uploadOnboardingLogo = multer({
  storage: onboardingLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^image\/(jpeg|png|gif|webp)$/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed for logo'));
  },
}).single('logo');

/** Platform-wide ads use segment `platform` (path uploads/ads/platform/). */
function getAdsUploadDir(segment) {
  const dir = path.join(UPLOAD_BASE, 'ads', String(segment || 'platform'));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function adsMediaRelativeUrl(segment, filename) {
  return `/uploads/ads/${segment}/${filename}`;
}

const adsStorage = multer.diskStorage({
  destination(req, file, cb) {
    const seg = req.adsUploadSegment || 'platform';
    cb(null, getAdsUploadDir(seg));
  },
  filename(req, file, cb) {
    const ext = (file.originalname && path.extname(file.originalname)) || '.bin';
    cb(null, `ad_${Date.now()}${ext}`);
  },
});

const uploadAdMedia = multer({
  storage: adsStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm))$/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM) are allowed'));
  },
}).single('file');

/** Same as uploadAdMedia; use after setting req.adsUploadSegment (default platform). */
const uploadAdOptionalFile = uploadAdMedia;

module.exports = {
  uploadProfile,
  uploadDocument,
  uploadMarketplaceMedia,
  uploadFlatDocument,
  uploadMemberDocument,
  uploadOnboardingLogo,
  getOnboardingLogoRelativeUrl,
  getAdsUploadDir,
  adsMediaRelativeUrl,
  uploadAdMedia,
  uploadAdOptionalFile,
  UPLOAD_BASE,
  getGuardUploadDir,
  getRelativeUrl,
  getMarketplaceUploadDir,
  marketplaceFileUrl,
  getFlatDocumentDir,
  getFlatDocumentRelativeUrl,
  getMemberDocumentDir,
  getMemberDocumentRelativeUrl,
};
