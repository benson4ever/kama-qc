const { pool } = require('../db/pool');
const { httpError } = require('../middleware/error');
const photoStorage = require('../services/photoStorage');

function normResult(r) {
  return r === 'approved' ? 'approved' : r === 'not_approved' ? 'not_approved' : null;
}

async function getOwned(id, user) {
  const { rows } = await pool.query('SELECT * FROM pp_samples WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) throw httpError(404, 'PP sample not found');
  if (user.role !== 'admin' && row.created_by !== user.id) {
    throw httpError(403, 'You can only modify your own entries');
  }
  return row;
}

async function withDetail(id) {
  const { rows } = await pool.query(
    `SELECT ps.*, s.name AS supplier_name, s.name_zh AS supplier_name_zh, u.name AS created_by_name
     FROM pp_samples ps
     JOIN suppliers s ON s.id = ps.supplier_id
     JOIN users u ON u.id = ps.created_by
     WHERE ps.id = $1`,
    [id]
  );
  const sample = rows[0];
  if (!sample) return null;
  const photos = await pool.query(
    'SELECT id, file_path, caption, created_at FROM pp_sample_photos WHERE pp_sample_id = $1 ORDER BY created_at ASC',
    [id]
  );
  sample.photos = photos.rows;
  return sample;
}

async function list(req, res) {
  const { rows } = await pool.query(
    `SELECT ps.*, s.name AS supplier_name, s.name_zh AS supplier_name_zh,
            u.name AS created_by_name, COALESCE(p.cnt, 0)::int AS photo_count
     FROM pp_samples ps
     JOIN suppliers s ON s.id = ps.supplier_id
     JOIN users u ON u.id = ps.created_by
     LEFT JOIN (SELECT pp_sample_id, COUNT(*) cnt FROM pp_sample_photos GROUP BY pp_sample_id) p
            ON p.pp_sample_id = ps.id
     ORDER BY ps.created_at DESC`
  );
  res.json(rows);
}

async function getOne(req, res) {
  const sample = await withDetail(req.params.id);
  if (!sample) throw httpError(404, 'PP sample not found');
  res.json(sample);
}

async function create(req, res) {
  const { supplier_id, po_number, style_id, fit, issues_text, result } = req.body || {};
  if (!supplier_id) throw httpError(400, 'Supplier is required');
  const r = normResult(result);
  if (!r) throw httpError(400, "result must be 'approved' or 'not_approved'");
  const { rows } = await pool.query(
    `INSERT INTO pp_samples (supplier_id, po_number, style_id, fit, issues_text, result, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [supplier_id, po_number || null, style_id || null, fit || null, issues_text || null, r, req.user.id]
  );
  res.status(201).json(await withDetail(rows[0].id));
}

async function update(req, res) {
  await getOwned(req.params.id, req.user);
  const { supplier_id, po_number, style_id, fit, issues_text, result } = req.body || {};
  const sets = []; const vals = []; let i = 1;
  const set = (c, v) => { sets.push(`${c} = $${i++}`); vals.push(v); };
  if (supplier_id !== undefined) set('supplier_id', supplier_id);
  if (po_number !== undefined) set('po_number', po_number);
  if (style_id !== undefined) set('style_id', style_id);
  if (fit !== undefined) set('fit', fit);
  if (issues_text !== undefined) set('issues_text', issues_text);
  if (result !== undefined) {
    const r = normResult(result);
    if (!r) throw httpError(400, 'Invalid result');
    set('result', r);
  }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(req.params.id);
  await pool.query(`UPDATE pp_samples SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  res.json(await withDetail(req.params.id));
}

async function remove(req, res) {
  await getOwned(req.params.id, req.user);
  await pool.query('DELETE FROM pp_samples WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

async function addPhoto(req, res) {
  const sample = await getOwned(req.params.id, req.user);
  if (!req.file) throw httpError(400, 'No photo uploaded');
  const supplier = await pool.query('SELECT name FROM suppliers WHERE id = $1', [sample.supplier_id]);
  const file_path = await photoStorage.savePhoto({
    entity: 'pp_sample',
    ownerId: sample.id,
    file: req.file,
    nextcloudInfo: { factory: supplier.rows[0] && supplier.rows[0].name, date: sample.created_at },
  });
  const { rows } = await pool.query(
    'INSERT INTO pp_sample_photos (pp_sample_id, file_path, caption) VALUES ($1, $2, $3) RETURNING id, file_path, caption, created_at',
    [sample.id, file_path, req.body.caption || null]
  );
  res.status(201).json(rows[0]);
}

async function deletePhoto(req, res) {
  await getOwned(req.params.id, req.user);
  const { rows } = await pool.query(
    'SELECT * FROM pp_sample_photos WHERE id = $1 AND pp_sample_id = $2',
    [req.params.photoId, req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Photo not found');
  await photoStorage.removePhoto(rows[0].file_path);
  await pool.query('DELETE FROM pp_sample_photos WHERE id = $1', [req.params.photoId]);
  res.json({ ok: true });
}

module.exports = { list, getOne, create, update, remove, addPhoto, deletePhoto };
