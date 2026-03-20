const Joi = require('joi');

const create = Joi.object({
  societyId: Joi.number().integer().required(),
  countryId: Joi.number().integer().min(1).required(),
  stateId: Joi.number().integer().min(1).required(),
  cityId: Joi.number().integer().min(1).required(),
  name: Joi.string().required().trim(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('').optional().trim(),
  tower: Joi.string().required().trim(),
  flatNumber: Joi.string().required().trim(),
  password: Joi.string().min(6).required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const review = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  rejectionReason: Joi.string().allow('').optional().trim(),
});

module.exports = { create, idParam, review };
