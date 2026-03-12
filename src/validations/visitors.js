const Joi = require('joi');

const entry = Joi.object({
  flatId: Joi.number().integer().required(),
  visitorName: Joi.string().required().trim(),
  visitorPhone: Joi.string().allow('').optional().trim(),
  purpose: Joi.string().allow('').optional().trim(),
  visitorType: Joi.string().valid('guest', 'delivery', 'vendor').optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { entry, idParam };
