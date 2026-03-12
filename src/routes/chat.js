const express = require('express');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const { scopeToUserSociety } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { chat: c } = require('../validations');

const router = express.Router();

const allowList = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Forbidden' });
};

router.use(authenticate, scopeToUserSociety);

router.get(
  '/groups',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  chatController.listGroups
);
router.post(
  '/groups',
  allowList(['society_admin', 'super_admin']),
  validate(c.createGroup),
  chatController.createGroup
);
router.get(
  '/groups/society-users',
  allowList(['society_admin', 'super_admin']),
  chatController.getSocietyUsers
);
router.get(
  '/groups/:id',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  validate(c.idParam, 'params'),
  chatController.getGroup
);
router.patch(
  '/groups/:id',
  allowList(['society_admin', 'super_admin']),
  validate(c.idParam, 'params'),
  validate(c.updateGroup),
  chatController.updateGroup
);
router.delete(
  '/groups/:id',
  allowList(['society_admin', 'super_admin']),
  validate(c.idParam, 'params'),
  chatController.deleteGroup
);

router.get(
  '/messages',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  validate(c.messagesQuery, 'query'),
  chatController.getMessages
);
router.post(
  '/message',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  validate(c.sendMessage),
  chatController.sendMessage
);
router.post(
  '/message/read',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  validate(c.markRead),
  chatController.markMessageRead
);
router.delete(
  '/message/:id',
  allowList(['society_admin', 'resident', 'security_guard', 'super_admin']),
  validate(c.messageIdParam, 'params'),
  chatController.deleteMessage
);
router.patch(
  '/message/:id/pin',
  allowList(['society_admin', 'super_admin']),
  validate(c.messageIdParam, 'params'),
  validate(c.pinBody),
  chatController.pinMessage
);

module.exports = router;
