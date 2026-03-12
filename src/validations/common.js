const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const tokenParam = Joi.object({
  token: Joi.string().required(),
});

module.exports = { idParam, tokenParam };
