const Joi = require('joi');

const createInvite = Joi.object({
  societyName: Joi.string().required().trim(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().allow('').optional().trim(),
  flatCount: Joi.number().integer().min(0).optional(),
  planType: Joi.string().valid('shared_app', 'white_label').optional(),
  setupFee: Joi.number().min(0).optional(),
  monthlyFee: Joi.number().min(0).optional(),
  address: Joi.string().allow('').optional().trim(),
});

const acceptInvite = Joi.object({
  address: Joi.string().allow('').optional().trim(),
  themeColor: Joi.string().allow('').optional().trim(),
  logo: Joi.string().allow('').optional().trim(),
  bannerImage: Joi.string().allow('').optional().trim(),
  towersBlocks: Joi.array().optional(),
  totalFlats: Joi.number().integer().min(0).optional(),
  adminContactName: Joi.string().allow('').optional().trim(),
  adminContactPhone: Joi.string().allow('').optional().trim(),
  adminEmail: Joi.string().email().optional(),
  adminPassword: Joi.string().min(6).optional(),
});

module.exports = { createInvite, acceptInvite };
