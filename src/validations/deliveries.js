const Joi = require('joi');

const create = Joi.object({
  flatId: Joi.number().integer().required(),
  deliveryType: Joi.string().trim().optional(),
  packagePhoto: Joi.string().uri().allow('', null).optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('received', 'notified', 'collected').required(),
});

module.exports = { create, idParam, updateStatus };
