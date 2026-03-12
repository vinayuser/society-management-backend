const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  password: Joi.string().optional(),
  otp: Joi.string().optional(),
}).min(1);

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { login, refresh };
