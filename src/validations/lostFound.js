const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().allow('', null).optional().trim(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('open', 'closed').required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, updateStatus, idParam };
