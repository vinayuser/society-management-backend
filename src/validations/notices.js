const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required().trim(),
  message: Joi.string().required().trim(),
  scheduledAt: Joi.date().iso().optional().allow(null),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, idParam };
