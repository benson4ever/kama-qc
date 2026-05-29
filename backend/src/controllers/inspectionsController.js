const { pool, withTransaction } = require('../db/pool');
const { httpError } = require('../middleware/error');
const photoStorage = require('../services/photoStorage');

const normType = (t) => (t === 'inline' ? 'inline' : t === 'final' ? 'final' : null);
const normResult = (r) => (r === 'pass' ? 'pass' : r === 'fail' ? 'fail' : null);
const toIntOrNull = (v) => (v === '' || v === null || v === undefined ? null : (parseInt(v, 10) || 0));

async function getOwned(id, user) {
  const { rows } = await pool.query('SELECT * FROM inspections WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) throw httpError(404, 'Inspection not found');
  if (user.role !== 'admin' && row.created_by !== user.id) {
    throw httpError(403, 'You can only modify your own entries');
  }
  return row;
}

function validateIssue(it) {
  const hasDefect = !!it.defect_id;
  const hasCustom = it.custom_description && String(it.custom_description).trim();
  if (!hasDefect && !hasCustom) {
    throw httpError(400, 'Each issue needs a standard defect or a custom description');
  }
  return {
    defect_id: hasDefect ? it.defect_id : null,
    custom_description: hasCustom ? String(it.custom_description).trim() : null,
    pcs_found: parseInt(it.pcs_found, 10) || 0,
  };
}

async function withDetail(id) {
  const { rows } = await pool.query(
    `SELECT i.*, s.name AS supplier_name, s.name_zh AS supplier_name_zh, u.name AS created_by_name,
            COALESCE((SELECT SUM(pcs_found) FROM inspection_issues WHERE inspection_id = i.id), 0)::int AS with_issues
     FROM inspections i
     JOIN suppliers s ON s.id = i.supplier_id
     JOIN users u ON u.id = i.created_by
     WHERE i.id = $1`,
    [id]
  );
  const insp = rows[0];
  if (!insp) return null;
  const issues = await pool.query(
    `SELECT ii.id, ii.defect_id, ii.custom_description, ii.pcs_found, ii.created_at,
            d.code AS defect_code, d.name_en AS defect_name_en, d.name_zh AS defect_name_zh,
            d.classification AS defect_classification
     FROM inspection_issues ii
     LEFT JOIN defects d ON d.id = ii.defect_id
     WHERE ii.inspection_id = $1
     ORDER BY ii.created_at ASC`,
    [id]
  );
  const ids = issues.rows.map((r) => r.id);
  const byIssue = {};
  if (ids.length) {
    const ph = await pool.query(
      `SELECT id, inspection_issue_id, file_path, caption, created_at
       FROM inspection_issue_photos WHERE inspection_issue_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );
    for (const p of ph.rows) (byIssue[p.inspection_issue_id] ||= []).push(p);
  }
  insp.issues = issues.rows.map((r) => ({ ...r, photos: byIssue[r.id] || [] }));
  return insp;
}

async function list(req, res) {
  const { rows } = await pool.query(
    `SELECT i.*, s.name AS supplier_name, s.name_zh AS supplier_name_zh, u.name AS created_by_name,
            COALESCE(agg.with_issues, 0)::int AS with_issues,
            COALESCE(agg.issue_count, 0)::int AS issue_count
     FROM inspections i
     JOIN suppliers s ON s.id = i.supplier_id
     JOIN users u ON u.id = i.created_by
     LEFT JOIN (SELECT inspection_id, SUM(pcs_found) AS with_issues, COUNT(*) AS issue_count
                FROM inspection_issues GROUP BY inspection_id) agg ON agg.inspection_id = i.id
     ORDER BY i.created_at DESC`
  );
  res.json(rows);
}

async function getOne(req, res) {
  const insp = await withDetail(req.params.id);
  if (!insp) throw httpError(404, 'Inspection not found');
  res.json(insp);
}

async function create(req, res) {
  const b = req.body || {};
  if (!b.supplier_id) throw httpError(400, 'Supplier is required');
  const type = normType(b.type);
  if (!type) throw httpError(400, "type must be 'inline' or 'final'");
  const result = normResult(b.result);
  if (!result) throw httpError(400, "result must be 'pass' or 'fail'");
  const issues = Array.isArray(b.issues) ? b.issues.map(validateIssue) : [];

  const id = await withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO inspections
        (supplier_id, po_number, date_from, date_to, type, total_order_qty, total_inspected, result, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.supplier_id, b.po_number || null, b.date_from || null, b.date_to || null, type,
       toIntOrNull(b.total_order_qty), toIntOrNull(b.total_inspected), result, req.user.id]
    );
    const inspId = ins.rows[0].id;
    for (const it of issues) {
      await client.query(
        `INSERT INTO inspection_issues (inspection_id, defect_id, custom_description, pcs_found)
         VALUES ($1, $2, $3, $4)`,
        [inspId, it.defect_id, it.custom_description, it.pcs_found]
      );
    }
    return inspId;
  });
  res.status(201).json(await withDetail(id));
}

async function update(req, res) {
  await getOwned(req.params.id, req.user);
  const b = req.body || {};
  const sets = []; const vals = []; let i = 1;
  const set = (c, v) => { sets.push(`${c} = $${i++}`); vals.push(v); };
  if (b.supplier_id !== undefined) set('supplier_id', b.supplier_id);
  if (b.po_number !== undefined) set('po_number', b.po_number);
  if (b.date_from !== undefined) set('date_from', b.date_from || null);
  if (b.date_to !== undefined) set('date_to', b.date_to || null);
  if (b.type !== undefined) { const t = normType(b.type); if (!t) throw httpError(400, 'Invalid type'); set('type', t); }
  if (b.total_order_qty !== undefined) set('total_order_qty', toIntOrNull(b.total_order_qty));
  if (b.total_inspected !== undefined) set('total_inspected', toIntOrNull(b.total_inspected));
  if (b.result !== undefined) { const r = normResult(b.result); if (!r) throw httpError(400, 'Invalid result'); set('result', r); }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(req.params.id);
  await pool.query(`UPDATE inspections SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  res.json(await withDetail(req.params.id));
}

async function remove(req, res) {
  await getOwned(req.params.id, req.user);
  await pool.query('DELETE FROM inspections WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

async function addIssue(req, res) {
  await getOwned(req.params.id, req.user);
  const it = validateIssue(req.body || {});
  const { rows } = await pool.query(
    `INSERT INTO inspection_issues (inspection_id, defect_id, custom_description, pcs_found)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.params.id, it.defect_id, it.custom_description, it.pcs_found]
  );
  const { rows: full } = await pool.query(
    `SELECT ii.id, ii.defect_id, ii.custom_description, ii.pcs_found, ii.created_at,
            d.code AS defect_code, d.name_en AS defect_name_en, d.name_zh AS defect_name_zh,
            d.classification AS defect_classification
     FROM inspection_issues ii LEFT JOIN defects d ON d.id = ii.defect_id WHERE ii.id = $1`,
    [rows[0].id]
  );
  res.status(201).json({ ...full[0], photos: [] });
}

async function removeIssue(req, res) {
  await getOwned(req.params.id, req.user);
  const { rowCount } = await pool.query(
    'DELETE FROM inspection_issues WHERE id = $1 AND inspection_id = $2',
    [req.params.issueId, req.params.id]
  );
  if (!rowCount) throw httpError(404, 'Issue not found');
  res.json({ ok: true });
}

async function addIssuePhoto(req, res) {
  const insp = await getOwned(req.params.id, req.user);
  const { rows } = await pool.query(
    'SELECT * FROM inspection_issues WHERE id = $1 AND inspection_id = $2',
    [req.params.issueId, req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Issue not found');
  if (!req.file) throw httpError(400, 'No photo uploaded');
  const supplier = await pool.query('SELECT name FROM suppliers WHERE id = $1', [insp.supplier_id]);
  const file_path = await photoStorage.savePhoto({
    entity: 'inspection_issue',
    ownerId: rows[0].id,
    file: req.file,
    nextcloudInfo: { factory: supplier.rows[0] && supplier.rows[0].name, date: insp.date_from || insp.created_at },
  });
  const photo = await pool.query(
    `INSERT INTO inspection_issue_photos (inspection_issue_id, file_path, caption)
     VALUES ($1, $2, $3) RETURNING id, file_path, caption, created_at`,
    [rows[0].id, file_path, req.body.caption || null]
  );
  res.status(201).json(photo.rows[0]);
}

async function deleteIssuePhoto(req, res) {
  await getOwned(req.params.id, req.user);
  const { rows } = await pool.query(
    `SELECT iip.* FROM inspection_issue_photos iip
     JOIN inspection_issues ii ON ii.id = iip.inspection_issue_id
     WHERE iip.id = $1 AND ii.inspection_id = $2`,
    [req.params.photoId, req.params.id]
  );
  if (!rows[0]) throw httpError(404, 'Photo not found');
  await photoStorage.removePhoto(rows[0].file_path);
  await pool.query('DELETE FROM inspection_issue_photos WHERE id = $1', [req.params.photoId]);
  res.json({ ok: true });
}

async function updateIssue(req, res) {
  await getOwned(req.params.id, req.user);
  const { pcs_found, custom_description } = req.body || {};
  const sets = []; const vals = []; let i = 1;
  if (pcs_found !== undefined) { sets.push(`pcs_found = $${i++}`); vals.push(parseInt(pcs_found, 10) || 0); }
  if (custom_description !== undefined) {
    sets.push(`custom_description = $${i++}`);
    vals.push(custom_description ? String(custom_description).trim() : null);
  }
  if (!sets.length) throw httpError(400, 'Nothing to update');
  vals.push(req.params.issueId, req.params.id);
  const { rowCount } = await pool.query(
    `UPDATE inspection_issues SET ${sets.join(', ')} WHERE id = $${i++} AND inspection_id = $${i}`, vals
  );
  if (!rowCount) throw httpError(404, 'Issue not found');
  res.json({ ok: true });
}

module.exports = {
  list, getOne, create, update, remove,
  addIssue, updateIssue, removeIssue, addIssuePhoto, deleteIssuePhoto,
};
