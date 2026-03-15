const Joi = require('joi');

const create = Joi.object({
  societyId: Joi.number().integer().required(),
  amount: Joi.number().min(0).required(),
  type: Joi.string().valid('setup', 'monthly', 'quarterly', 'yearly').required(),
  billingDate: Joi.date().iso().required(),
  dueDate: Joi.date().iso().optional(),
  notes: Joi.string().allow('').optional().trim(),
});

const updatePaymentStatus = Joi.object({
  paymentStatus: Joi.string().valid('pending', 'paid', 'overdue', 'cancelled').required(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const verifyPayment = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
});

module.exports = { create, updatePaymentStatus, idParam, verifyPayment };
