const Joi = require('joi');

const create = Joi.object({
  societyId: Joi.number().integer().optional(),
  type: Joi.string().valid('banner', 'video', 'promotion').optional(),
  contentUrl: Joi.string().uri().required(),
  title: Joi.string().allow('').optional().trim(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, idParam };
