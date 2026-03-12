const config = require('../config');

function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.statusCode || err.status || 500;
  const message = status === 500 && config.env === 'production'
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(status).json({
    success: false,
    message,
    ...(config.env !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
