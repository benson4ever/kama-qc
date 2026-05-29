const { pool } = require('../db/pool');
const { httpError } = require('../middleware/error');

async function list(req, res) {
  const onlyActive = req.query.active === '1' || req.query.active === 'true';
  const { rows } = await pool.query(
    `SELECT * FROM defects ${onlyActive ? 'WHERE active = true' : ''}
     ORDER BY classification DESC, sort_order ASC, name_en ASC`
  );
  res.json(rows);
}

function normClass(c) {
  return c === 'major' ? 'major' : c === 'minor' ? 'minor' : null;
}

async function create(req, res) {
  const { code, name_en, name_zh, classification, sort_order } = req.body || {};
  if (!code || !name_en) throw httpError(400, 'code and name_en are required');
  const cls = normClass(classification);
  if (!cls) throw httpError(400, "classification must be 'major' or 'minor'");
  try {
    const { rows } = await pool.query(
      `INSERT INTO defects (code, name_en, name_zh, classification, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [code.trim(), name_en.trim(), name_zh || null, cls, Number.isInteger(sort_order) ? sort_order : 999]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'A defect with that code already exists');
    throw e;
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name_en, name_zh, classification, sort_order, active } = req.body || {};
  const sets = []; const vals = []; let i = 1;
  if (name_en !== undefined) { sets.push(`name_en = $${i++}`); vals.push(name_en); }
  if (name_zh !== undefined) { sets.push(`name_zh = $${i++}`); vals.push(name_zh); }
  if (classification !== undefined) {
    const cls = normClass(classification);
    if (!cls) throw httpError(400, "classification must be 'major' or 'minor'");
    sets.push(`classification = $${i++}`); vals.push(cls);
  }
  if (sort_order !== undefined) { sets.push(`sort_order = $${i++}`); vals.push(parseInt(sort_order, 10) || 0); }
  if (active !== undefined) { sets.push(`active = $${i++}`); vals.push(Boolean(active)); }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(id);
  const { rows } = await pool.query(`UPDATE defects SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows[0]) throw httpError(404, 'Defect not found');
  res.json(rows[0]);
}

module.exports = { list, create, update };
