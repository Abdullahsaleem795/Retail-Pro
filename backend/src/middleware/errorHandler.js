const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
};

// Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message;

  if (err.code === '22P02') {
    // invalid_text_representation - most commonly a malformed UUID in a URL
    // param, equivalent to Mongoose's old CastError-on-ObjectId case.
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === '23505') {
    // unique_violation
    statusCode = 409;
    const match = /Key \(([^)]+)\)/.exec(err.detail || '');
    const field = match ? match[1] : 'unknown';
    if (field === 'email') {
      message = 'An account with this email address is already registered. Please sign in instead.';
    } else if (field === 'barcode') {
      message = 'A product with this barcode already exists in your inventory.';
    } else {
      message = `Duplicate value for field: ${field}`;
    }
  }

  if (err.code === '23503') {
    // foreign_key_violation - e.g. deleting a supplier that still has purchase history
    statusCode = 409;
    message = 'This record is referenced by other data and cannot be deleted';
  }

  if (err.code === '23514') {
    // check_violation - e.g. negative price, invalid enum value
    statusCode = 400;
    message = err.detail || 'Invalid value for one or more fields';
  }

  if (err.code === '23502') {
    // not_null_violation
    statusCode = 400;
    message = `Missing required field: ${err.column || 'unknown'}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
