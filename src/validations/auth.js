const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).optional(),
  phone: Joi.string().optional(),
  password: Joi.string().optional(),
  otp: Joi.string().optional(),
}).min(1);

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

const setPassword = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).max(128).required(),
});

const sendSetPasswordLink = Joi.object({
  userId: Joi.number().integer().required(),
});

module.exports = { login, refresh, setPassword, sendSetPasswordLink };
