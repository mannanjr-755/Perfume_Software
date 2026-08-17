import { fail } from '../utils/apiResponse.js';

function isCastError(err) {
  return err?.name === 'CastError';
}

function isValidationError(err) {
  return err?.name === 'ValidationError';
}

function isDuplicateKeyError(err) {
  return err?.code === 11000 || (err?.name === 'MongoServerError' && err?.code === 11000);
}

function extractDuplicateMessage(err) {
  try {
    const keys = Object.keys(err.keyPattern || {});
    if (keys.length) return `A record with this ${keys.join(', ')} already exists`;
  } catch {
    /* ignore */
  }
  return 'A record with this value already exists';
}

function extractValidationMessage(err) {
  const fields = Object.keys(err.errors || {}).map((key) => {
    const entry = err.errors[key];
    return entry?.message || `Invalid value for ${key}`;
  });
  return fields.length ? fields[0] : 'Validation failed';
}

export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Something went wrong';

  if (isCastError(err)) {
    status = 400;
    message = 'Invalid identifier format';
  } else if (isValidationError(err)) {
    status = 400;
    message = extractValidationMessage(err);
  } else if (isDuplicateKeyError(err)) {
    status = 400;
    message = extractDuplicateMessage(err);
  }

  if (status >= 500) {
    console.error('[API Error]', err);
  }

  return fail(res, message, status);
}

export function notFoundHandler(_req, res) {
  return fail(res, 'Route not found', 404);
}
