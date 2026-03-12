const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().allow('', null).optional().trim(),
  options: Joi.array().items(Joi.string().trim()).min(1).optional(),
});

const vote = Joi.object({
  optionId: Joi.number().integer().required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, vote, idParam };
