const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const config = require('../config');
const { httpError } = require('../middleware/error');
const { bearerToken, PHOTO_COOKIE } = require('../middleware/auth');

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, name_zh: u.name_zh, role: u.role, active: u.active };
}

// Mirror the JWT into an HttpOnly cookie scoped to /api/uploads so plain
// <img> tags can load photos (and the browser can cache them). Same lifetime as the JWT.
const PHOTO_COOKIE_PATH = '/api/uploads';
function setPhotoCookie(req, res, token) {
  const payload = jwt.decode(token);
  res.cookie(PHOTO_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure, // https in production (trust proxy is on); plain http only on local/staging
    path: PHOTO_COOKIE_PATH,
    expires: payload && payload.exp ? new Date(payload.exp * 1000) : undefined,
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'Email and password are required');
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
  const user = rows[0];
  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
    throw httpError(401, 'Invalid email or password');
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  setPhotoCookie(req, res, token);
  res.json({ token, user: publicUser(user) });
}

// Called by the frontend at app start (existing sessions have a JWT in
// localStorage but may not have the cookie yet, e.g. before this feature).
async function photoSession(req, res) {
  setPhotoCookie(req, res, bearerToken(req));
  res.json({ ok: true });
}

async function logout(req, res) {
  res.clearCookie(PHOTO_COOKIE, { path: PHOTO_COOKIE_PATH });
  res.json({ ok: true });
}

async function me(req, res) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || !rows[0].active) throw httpError(401, 'User is no longer active');
  res.json({ user: publicUser(rows[0]) });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw httpError(400, 'Current and new password are required');
  if (String(newPassword).length < 8) throw httpError(400, 'New password must be at least 8 characters');
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    throw httpError(401, 'Current password is incorrect');
  }
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), user.id]);
  res.json({ ok: true });
}

module.exports = { login, me, changePassword, photoSession, logout, publicUser };
