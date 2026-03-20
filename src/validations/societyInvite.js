const Joi = require('joi');

const createInvite = Joi.object({
  societyName: Joi.string().required().trim(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().allow('').optional().trim(),
  countryId: Joi.number().integer().min(1).required(),
  stateId: Joi.number().integer().min(1).required(),
  cityId: Joi.number().integer().min(1).required(),
  flatCount: Joi.number().integer().min(0).optional(),
  planType: Joi.string().valid('shared_app', 'white_label').optional(),
  planId: Joi.number().integer().min(1).optional().allow(null),
  setupFee: Joi.number().min(0).optional(),
  monthlyFee: Joi.number().min(0).optional(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').optional(),
  yearlyFee: Joi.number().min(0).optional(),
  address: Joi.string().allow('').optional().trim(),
});

const createSetupOrderBody = Joi.object({
  billingIds: Joi.array().items(Joi.number().integer().min(1)).min(1).required(),
}).unknown(true);

const acceptInvite = Joi.object({
  address: Joi.string().allow('').optional().trim(),
  countryId: Joi.number().integer().min(1).optional(),
  stateId: Joi.number().integer().min(1).optional(),
  cityId: Joi.number().integer().min(1).optional(),
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

const createSetupOrder = Joi.object({
  billingId: Joi.number().integer().optional(),
  billingIds: Joi.array().items(Joi.number().integer().min(1)).min(1).optional(),
}).or('billingId', 'billingIds');

const verifyPayment = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
});

module.exports = { createInvite, acceptInvite, createSetupOrder, createSetupOrderBody, verifyPayment };
