const jwt = require('jsonwebtoken');
const config = require('../config');
const { httpError } = require('./error');

// Verify the JWT and attach req.user = { id, role, email }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) return next(httpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(match[1], config.jwt.secret);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (e) {
    next(httpError(401, 'Invalid or expired session'));
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(httpError(403, 'Admin access required'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
