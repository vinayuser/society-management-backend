const Joi = require('joi');

const ROLES = ['owner', 'tenant', 'family_member', 'committee_member', 'security_staff', 'maintenance_staff'];
const STATUSES = ['active', 'inactive', 'moved_out', 'blacklisted'];

const create = Joi.object({
  flatId: Joi.number().integer().optional().allow(null),
  userId: Joi.number().integer().optional().allow(null),
  name: Joi.string().trim().max(255).required(),
  profileImage: Joi.string().trim().max(512).optional().allow('', null),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  email: Joi.string().email().trim().max(255).optional().allow('', null),
  role: Joi.string().trim().valid(...ROLES).optional(),
  gender: Joi.string().trim().max(16).optional().allow('', null),
  dob: Joi.date().optional().allow(null),
  occupation: Joi.string().trim().max(255).optional().allow('', null),
  status: Joi.string().trim().valid(...STATUSES).optional(),
  joinedAt: Joi.date().optional().allow(null),
});

const update = Joi.object({
  flatId: Joi.number().integer().optional().allow(null),
  userId: Joi.number().integer().optional().allow(null),
  name: Joi.string().trim().max(255).optional().allow('', null),
  profileImage: Joi.string().trim().max(512).optional().allow('', null),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  email: Joi.string().email().trim().max(255).optional().allow('', null),
  role: Joi.string().trim().valid(...ROLES).optional().allow('', null),
  gender: Joi.string().trim().max(16).optional().allow('', null),
  dob: Joi.date().optional().allow(null),
  occupation: Joi.string().trim().max(255).optional().allow('', null),
  status: Joi.string().trim().valid(...STATUSES).optional().allow('', null),
  joinedAt: Joi.date().optional().allow(null),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const familyBody = Joi.object({
  name: Joi.string().trim().max(255).required(),
  relationship: Joi.string().trim().max(64).optional().allow('', null),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  age: Joi.number().integer().min(0).max(150).optional().allow(null),
});

const familyUpdateBody = Joi.object({
  name: Joi.string().trim().max(255).optional(),
  relationship: Joi.string().trim().max(64).optional().allow('', null),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  age: Joi.number().integer().min(0).max(150).optional().allow(null),
});

const familyIdParam = Joi.object({
  id: Joi.number().integer().required(),
  familyId: Joi.number().integer().required(),
});

const vehicleBody = Joi.object({
  vehicleNumber: Joi.string().trim().max(64).required(),
  vehicleType: Joi.string().trim().max(32).optional(),
  parkingSlot: Joi.string().trim().max(64).optional().allow('', null),
});

const vehicleUpdateBody = Joi.object({
  vehicleNumber: Joi.string().trim().max(64).optional(),
  vehicleType: Joi.string().trim().max(32).optional(),
  parkingSlot: Joi.string().trim().max(64).optional().allow('', null),
});

const vehicleIdParam = Joi.object({
  id: Joi.number().integer().required(),
  vehicleId: Joi.number().integer().required(),
});

const docIdParam = Joi.object({
  id: Joi.number().integer().required(),
  docId: Joi.number().integer().required(),
});

const emergencyBody = Joi.object({
  contactName: Joi.string().trim().max(255).required(),
  relationship: Joi.string().trim().max(64).optional().allow('', null),
  phone: Joi.string().trim().max(32).required(),
});

const emergencyUpdateBody = Joi.object({
  contactName: Joi.string().trim().max(255).optional(),
  relationship: Joi.string().trim().max(64).optional().allow('', null),
  phone: Joi.string().trim().max(32).optional(),
});

const contactIdParam = Joi.object({
  id: Joi.number().integer().required(),
  contactId: Joi.number().integer().required(),
});

module.exports = {
  create,
  update,
  idParam,
  familyBody,
  familyUpdateBody,
  familyIdParam,
  vehicleBody,
  vehicleUpdateBody,
  vehicleIdParam,
  docIdParam,
  emergencyBody,
  emergencyUpdateBody,
  contactIdParam,
};
