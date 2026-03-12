const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().required().trim(),
  email: Joi.string().email().optional().allow(''),
  phone: Joi.string().allow('').optional().trim(),
  flatId: Joi.number().integer().required(),
  password: Joi.string().min(6).optional(),
  isPrimary: Joi.boolean().optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, idParam };
