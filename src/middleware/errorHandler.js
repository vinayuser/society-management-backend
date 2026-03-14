const config = require('../config');

function errorHandler(err, req, res, next) {
  console.error(err);

  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'File too large';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE' || (err.message && err.message.includes('Unexpected field'))) {
    status = 400;
    message = 'Invalid file field. Use field name: logo';
  } else if (status === 500 && config.env === 'production') {
    message = 'Internal server error';
  }

  res.status(status).json({
    success: false,
    message,
    ...(config.env !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
