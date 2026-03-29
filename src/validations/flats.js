const Joi = require('joi');

const create = Joi.object({
  tower: Joi.string().required().trim(),
  flatNumber: Joi.string().required().trim(),
  floor: Joi.number().integer().min(0).optional(),
  flatType: Joi.string().trim().max(32).optional(),
  areaSqft: Joi.number().min(0).optional(),
  ownershipType: Joi.string().trim().max(32).optional(),
  ownerName: Joi.string().trim().max(255).optional(),
  ownerContact: Joi.string().trim().max(32).optional(),
  ownerEmail: Joi.string().email().trim().max(255).optional(),
  status: Joi.string().trim().max(32).optional(),
});

const update = Joi.object({
  tower: Joi.string().trim().max(64).optional().allow('', null),
  flatNumber: Joi.string().trim().max(64).optional().allow('', null),
  floor: Joi.number().integer().min(0).optional().allow(null),
  flatType: Joi.string().trim().max(32).optional().allow('', null),
  areaSqft: Joi.number().min(0).optional().allow(null),
  ownershipType: Joi.string().trim().max(32).optional().allow('', null),
  ownerName: Joi.string().trim().max(255).optional().allow('', null),
  ownerContact: Joi.string().trim().max(32).optional().allow('', null),
  ownerEmail: Joi.string().email().trim().max(255).optional().allow('', null),
  status: Joi.string().trim().max(32).optional().allow('', null),
});

const bulkCreate = Joi.object({
  flats: Joi.array()
    .items(
      Joi.object({
        tower: Joi.string().required(),
        flatNumber: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        towerBlock: Joi.string().optional(),
        flat_number: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
        floor: Joi.number().integer().min(0).optional().allow(null),
        flatType: Joi.string().trim().max(32).optional().allow('', null),
        areaSqft: Joi.number().min(0).optional().allow(null),
        status: Joi.string().trim().max(32).optional().allow('', null),
      })
    )
    .min(1)
    .max(10000)
    .required(),
  defaults: Joi.object({
    floor: Joi.number().integer().min(0).optional().allow(null),
    flatType: Joi.string().trim().max(32).optional().allow('', null),
    areaSqft: Joi.number().min(0).optional().allow(null),
    status: Joi.string().trim().max(32).optional().allow('', null),
  }).optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

const memberBody = Joi.object({
  name: Joi.string().trim().max(255).required(),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  email: Joi.string().email().trim().max(255).optional().allow('', null),
  role: Joi.string().trim().valid('owner', 'tenant', 'family_member', 'domestic_help').optional(),
  userId: Joi.number().integer().optional().allow(null),
});

const memberUpdateBody = Joi.object({
  name: Joi.string().trim().max(255).optional(),
  phone: Joi.string().trim().max(32).optional().allow('', null),
  email: Joi.string().email().trim().max(255).optional().allow('', null),
  role: Joi.string().trim().valid('owner', 'tenant', 'family_member', 'domestic_help').optional(),
});

const memberIdParam = Joi.object({
  id: Joi.number().integer().required(),
  memberId: Joi.number().integer().required(),
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

module.exports = { create, update, bulkCreate, idParam, memberBody, memberUpdateBody, memberIdParam, vehicleBody, vehicleUpdateBody, vehicleIdParam, docIdParam };
