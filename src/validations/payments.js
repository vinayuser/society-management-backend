const Joi = require('joi');

const sendReminder = Joi.object({
  societyId: Joi.number().integer().required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
});

const createOrder = Joi.object({
  billingId: Joi.number().integer().required(),
});

module.exports = { sendReminder, createOrder };
