const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().allow('', null).optional().trim(),
  price: Joi.number().min(0).allow(null).optional(),
  imageUrl: Joi.string().allow('', null).optional(),
  mediaUrls: Joi.array().items(Joi.string()).optional(),
  category: Joi.string().trim().allow('', null).optional(),
  itemCondition: Joi.string().valid('new', 'used').optional(),
});

const update = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().allow('', null).optional().trim(),
  price: Joi.number().min(0).allow(null).optional(),
  mediaUrls: Joi.array().items(Joi.string()).optional(),
  category: Joi.string().trim().allow('', null).optional(),
  itemCondition: Joi.string().valid('new', 'used').optional(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('active', 'sold', 'removed').required(),
});

const pinBody = Joi.object({
  isPinned: Joi.boolean().required(),
});

const listedGloballyBody = Joi.object({
  listedGlobally: Joi.boolean().required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const createTransaction = Joi.object({
  itemId: Joi.number().integer().required(),
});

module.exports = {
  create,
  update,
  updateStatus,
  pinBody,
  listedGloballyBody,
  idParam,
  createTransaction,
};
