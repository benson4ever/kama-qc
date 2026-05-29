const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { httpError } = require('../middleware/error');
const { publicUser } = require('./authController');

async function list(req, res) {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
  res.json(rows.map(publicUser));
}

async function create(req, res) {
  let { email, name, name_zh, role, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'Email and password are required');
  if (String(password).length < 8) throw httpError(400, 'Password must be at least 8 characters');
  role = role === 'admin' ? 'admin' : 'staff';
  const hash = bcrypt.hashSync(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, name_zh, role, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [String(email).toLowerCase().trim(), name || null, name_zh || null, role, hash]
    );
    res.status(201).json(publicUser(rows[0]));
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'A user with that email already exists');
    throw e;
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, name_zh, role, active, password } = req.body || {};

  // guard against an admin locking themselves out
  if (id === req.user.id && (active === false || role === 'staff')) {
    throw httpError(400, 'You cannot demote or deactivate your own admin account');
  }

  const sets = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); vals.push(name); }
  if (name_zh !== undefined) { sets.push(`name_zh = $${i++}`); vals.push(name_zh); }
  if (role !== undefined) { sets.push(`role = $${i++}`); vals.push(role === 'admin' ? 'admin' : 'staff'); }
  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(Boolean(active)); }
  if (password) {
    if (String(password).length < 8) throw httpError(400, 'Password must be at least 8 characters');
    sets.push(`password_hash = $${i++}`); vals.push(bcrypt.hashSync(password, 10));
  }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(id);
  const { rows } = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows[0]) throw httpError(404, 'User not found');
  res.json(publicUser(rows[0]));
}

module.exports = { list, create, update };
