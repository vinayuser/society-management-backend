const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().required().trim(),
  phone: Joi.string().required().trim(),
  email: Joi.string().email().allow('', null).optional(),
  employeeId: Joi.string().trim().allow('', null).optional(),
  role: Joi.string().valid('guard', 'head_guard', 'supervisor').optional(),
  assignedBlocks: Joi.string().trim().allow('', null).optional(),
  joiningDate: Joi.date().iso().allow(null).optional(),
});

const update = Joi.object({
  name: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  email: Joi.string().email().allow('', null).optional(),
  employeeId: Joi.string().trim().allow('', null).optional(),
  role: Joi.string().valid('guard', 'head_guard', 'supervisor').optional(),
  assignedBlocks: Joi.string().trim().allow('', null).optional(),
  joiningDate: Joi.date().iso().allow(null).optional(),
  isActive: Joi.boolean().optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const guardIdParam = Joi.object({
  guardId: Joi.number().integer().required(),
});

const shiftBody = Joi.object({
  shiftStart: Joi.date().iso().required(),
  shiftEnd: Joi.date().iso().required(),
  assignedGate: Joi.string().trim().allow('', null).optional(),
});

const shiftUpdate = Joi.object({
  shiftStart: Joi.date().iso().optional(),
  shiftEnd: Joi.date().iso().optional(),
  assignedGate: Joi.string().trim().allow('', null).optional(),
});

const shiftIdParam = Joi.object({
  guardId: Joi.number().integer().required(),
  shiftId: Joi.number().integer().required(),
});

const leaveBody = Joi.object({
  leaveType: Joi.string().valid('sick', 'casual', 'vacation', 'emergency').optional(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  notes: Joi.string().trim().allow('', null).optional(),
});

const leaveStatusBody = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
});

const leaveIdParam = Joi.object({
  guardId: Joi.number().integer().required(),
  leaveId: Joi.number().integer().required(),
});

const docIdParam = Joi.object({
  guardId: Joi.number().integer().required(),
  docId: Joi.number().integer().required(),
});

module.exports = {
  create,
  update,
  idParam,
  guardIdParam,
  shiftBody,
  shiftUpdate,
  shiftIdParam,
  leaveBody,
  leaveStatusBody,
  leaveIdParam,
  docIdParam,
};
