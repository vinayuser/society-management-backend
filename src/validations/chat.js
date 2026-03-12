const Joi = require('joi');
const { idParam } = require('./common');

const createGroup = Joi.object({
  name: Joi.string().required().trim().max(255),
  description: Joi.string().trim().max(2000).optional().allow('', null),
  icon: Joi.string().trim().max(128).optional().allow('', null),
  adminOnlyPosting: Joi.boolean().optional(),
  memberIds: Joi.array().items(Joi.number().integer().min(1)).optional().default([]),
});

const updateGroup = Joi.object({
  name: Joi.string().trim().max(255).optional(),
  description: Joi.string().trim().max(2000).optional().allow('', null),
  icon: Joi.string().trim().max(128).optional().allow('', null),
  adminOnlyPosting: Joi.boolean().optional(),
  memberIds: Joi.array().items(Joi.number().integer().min(1)).optional(),
});

const sendMessage = Joi.object({
  groupId: Joi.number().integer().required(),
  messageText: Joi.string().required().trim().max(10000),
  messageType: Joi.string().valid('text', 'image', 'file', 'emoji').optional().default('text'),
  mediaUrl: Joi.string().uri().max(512).optional().allow('', null),
});

const messagesQuery = Joi.object({
  group_id: Joi.number().integer().required(),
  limit: Joi.number().integer().min(1).max(100).optional().default(50),
  offset: Joi.number().integer().min(0).optional().default(0),
});

const markRead = Joi.object({
  messageId: Joi.number().integer().required(),
});

const messageIdParam = Joi.object({
  id: Joi.number().integer().required(),
});

const pinBody = Joi.object({
  pin: Joi.boolean().required(),
});

module.exports = {
  createGroup,
  updateGroup,
  sendMessage,
  messagesQuery,
  markRead,
  idParam,
  messageIdParam,
  pinBody,
};
