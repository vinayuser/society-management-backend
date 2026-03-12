const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().required().trim(),
  category: Joi.string().allow('').optional().trim(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved').required(),
  assignedStaffId: Joi.number().integer().optional().allow(null),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, updateStatus, idParam };
