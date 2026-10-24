const jwt = require('jsonwebtoken');
const config = require('../config');
const { httpError } = require('./error');

// Photos are loaded by plain <img> tags, which cannot send an Authorization
// header, so the same JWT is also kept in an HttpOnly cookie scoped to
// /api/uploads (set at login and by POST /api/auth/photo-session).
const PHOTO_COOKIE = 'qc_photo';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

function attachUser(req, token) {
  const payload = jwt.verify(token, config.jwt.secret);
  req.user = { id: payload.sub, role: payload.role, email: payload.email };
}

// Verify the JWT and attach req.user = { id, role, email }.
function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return next(httpError(401, 'Authentication required'));
  try {
    attachUser(req, token);
    next();
  } catch (e) {
    next(httpError(401, 'Invalid or expired session'));
  }
}

// Like requireAuth but also accepts the photo cookie (for <img> requests).
function requirePhotoAuth(req, res, next) {
  const token = bearerToken(req) || readCookie(req, PHOTO_COOKIE);
  if (!token) return next(httpError(401, 'Authentication required'));
  try {
    attachUser(req, token);
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

module.exports = { requireAuth, requirePhotoAuth, requireAdmin, bearerToken, PHOTO_COOKIE };
