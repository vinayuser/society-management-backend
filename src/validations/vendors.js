const Joi = require('joi');

const categories = [
  'plumber', 'electrician', 'grocery', 'water_delivery', 'laundry',
  'tutors', 'tiffin_services', 'cleaning_services', 'repair_services',
];

const create = Joi.object({
  vendorName: Joi.string().required().trim(),
  category: Joi.string().valid(...categories).required(),
  phone: Joi.string().allow('', null).optional().trim(),
  description: Joi.string().allow('', null).optional().trim(),
  serviceArea: Joi.string().allow('', null).optional().trim(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const update = Joi.object({
  vendorName: Joi.string().trim().optional(),
  category: Joi.string().valid(...categories).optional(),
  phone: Joi.string().allow('', null).optional().trim(),
  description: Joi.string().allow('', null).optional().trim(),
  serviceArea: Joi.string().allow('', null).optional().trim(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const idParam = Joi.object({
  id: Joi.number().integer().required(),
});

module.exports = { create, update, idParam };
