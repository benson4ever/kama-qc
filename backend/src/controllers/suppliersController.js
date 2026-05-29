const { pool } = require('../db/pool');
const { httpError } = require('../middleware/error');

async function list(req, res) {
  // ?active=1 limits to active suppliers (used by form dropdowns)
  const onlyActive = req.query.active === '1' || req.query.active === 'true';
  const { rows } = await pool.query(
    `SELECT * FROM suppliers ${onlyActive ? 'WHERE active = true' : ''} ORDER BY name ASC`
  );
  res.json(rows);
}

async function create(req, res) {
  const { name, name_zh } = req.body || {};
  if (!name || !name.trim()) throw httpError(400, 'Supplier name is required');
  try {
    const { rows } = await pool.query(
      `INSERT INTO suppliers (name, name_zh) VALUES ($1, $2) RETURNING *`,
      [name.trim(), name_zh || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'A supplier with that name already exists');
    throw e;
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, name_zh, active } = req.body || {};
  const sets = []; const vals = []; let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); vals.push(name); }
  if (name_zh !== undefined) { sets.push(`name_zh = $${i++}`); vals.push(name_zh); }
  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(Boolean(active)); }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(id);
  try {
    const { rows } = await pool.query(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
    if (!rows[0]) throw httpError(404, 'Supplier not found');
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'A supplier with that name already exists');
    throw e;
  }
}

module.exports = { list, create, update };
