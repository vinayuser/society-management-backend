/**
 * Joi validation middleware.
 * @param {Joi.ObjectSchema} schema - Joi schema to validate against
 * @param {'body'|'params'|'query'} [source='body'] - Request property to validate
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    if (source === 'body') {
      req.body = value;
    } else {
      Object.assign(req[source], value);
    }
    next();
  };
}

module.exports = { validate };
