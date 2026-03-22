const Joi = require('joi');

const dateField = Joi.alternatives().try(
  Joi.date(),
  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
);

const create = Joi.object({
  societyId: Joi.number().integer().optional(),
  type: Joi.string().valid('banner', 'video', 'promotion').optional(),
  contentUrl: Joi.string().trim().max(512).optional(),
  title: Joi.string().allow('', null).optional(),
  startDate: dateField.required(),
  endDate: dateField.required(),
  isActive: Joi.boolean().optional(),
});

const update = Joi.object({
  societyId: Joi.number().integer().optional(),
  type: Joi.string().valid('banner', 'video', 'promotion').optional(),
  contentUrl: Joi.string().trim().max(512).optional(),
  title: Joi.string().allow('', null).optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, update, idParam };
