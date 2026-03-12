const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('invited', 'onboarding_completed', 'active', 'suspended').required(),
});

const update = Joi.object({
  flatCount: Joi.number().integer().min(0).optional(),
  monthlyFee: Joi.number().min(0).optional(),
  setupFee: Joi.number().min(0).optional(),
});

const updateConfig = Joi.object({
  logo: Joi.string().uri().allow('', null).optional(),
  themeColor: Joi.string().max(32).allow('', null).optional(),
  address: Joi.string().allow('', null).optional(),
  bannerImage: Joi.string().uri().allow('', null).optional(),
  towersBlocks: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim()).max(100),
      Joi.string().allow('', null)
    )
    .optional(),
  totalFlats: Joi.number().integer().min(0).allow(null).optional(),
  adminContactName: Joi.string().max(255).allow('', null).optional(),
  adminContactPhone: Joi.string().max(32).allow('', null).optional(),
});

module.exports = { idParam, updateStatus, update, updateConfig };
