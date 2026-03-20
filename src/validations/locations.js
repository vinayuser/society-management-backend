const Joi = require('joi');

const pinState = Joi.object({
  isPinned: Joi.boolean().required(),
  pinnedRank: Joi.number().integer().min(1).optional().allow(null),
});

const stateIdParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { pinState, stateIdParam };

