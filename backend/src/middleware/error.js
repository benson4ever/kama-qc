// Wrap async route handlers so thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Build an error that is safe to expose to the client.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message =
    err.expose && err.message ? err.message
    : status >= 500 ? 'Internal server error'
    : err.message || 'Request failed';
  res.status(status).json({ error: message });
}

module.exports = { asyncHandler, httpError, notFound, errorHandler };
