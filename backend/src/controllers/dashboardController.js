const { pool } = require('../db/pool');
const { PO_TOKENS } = require('../db/poMatch');

/* All failed entries, each with the later passing entry (if any) for the same
   supplier and PO number — see db/poMatch.js for the PO/token rule. Where
   several later passes exist, the most recent one is returned, together with
   the matching PO token(s). The same rule drives the KPI "open fails" count. */

async function failedEntries() {
  const inspections = await pool.query(
    `SELECT f.id, f.po_number, f.type, f.date_from, f.date_to, f.created_at,
            s.name AS supplier_name, s.name_zh AS supplier_name_zh,
            p.id AS passed_id, p.type AS passed_type,
            p.date_from AS passed_date_from, p.date_to AS passed_date_to, p.created_at AS passed_created_at,
            p.matched_po AS passed_matched_po
     FROM inspections f
     JOIN suppliers s ON s.id = f.supplier_id
     CROSS JOIN LATERAL (SELECT ${PO_TOKENS('f.po_number')} AS arr) ftok
     LEFT JOIN LATERAL (
       SELECT p.id, p.type, p.date_from, p.date_to, p.created_at,
              (SELECT string_agg(upper(t), ' ' ORDER BY t) FROM unnest(ftok.arr) t WHERE t = ANY(ptok.arr)) AS matched_po
       FROM inspections p
       CROSS JOIN LATERAL (SELECT ${PO_TOKENS('p.po_number')} AS arr) ptok
       WHERE p.supplier_id = f.supplier_id
         AND p.id <> f.id
         AND p.result = 'pass'
         AND cardinality(ftok.arr) > 0
         AND ptok.arr && ftok.arr
         AND (COALESCE(p.date_from, p.created_at::date), p.created_at)
             > (COALESCE(f.date_from, f.created_at::date), f.created_at)
       ORDER BY COALESCE(p.date_from, p.created_at::date) DESC, p.created_at DESC
       LIMIT 1
     ) p ON true
     WHERE f.result = 'fail'
     ORDER BY COALESCE(f.date_from, f.created_at::date) DESC, f.created_at DESC`
  );

  const ppSamples = await pool.query(
    `SELECT f.id, f.po_number, f.style_id, f.created_at,
            s.name AS supplier_name, s.name_zh AS supplier_name_zh,
            p.id AS passed_id, p.style_id AS passed_style_id, p.created_at AS passed_created_at,
            p.matched_po AS passed_matched_po
     FROM pp_samples f
     JOIN suppliers s ON s.id = f.supplier_id
     CROSS JOIN LATERAL (SELECT ${PO_TOKENS('f.po_number')} AS arr) ftok
     LEFT JOIN LATERAL (
       SELECT p.id, p.style_id, p.created_at,
              (SELECT string_agg(upper(t), ' ' ORDER BY t) FROM unnest(ftok.arr) t WHERE t = ANY(ptok.arr)) AS matched_po
       FROM pp_samples p
       CROSS JOIN LATERAL (SELECT ${PO_TOKENS('p.po_number')} AS arr) ptok
       WHERE p.supplier_id = f.supplier_id
         AND p.id <> f.id
         AND p.result = 'approved'
         AND cardinality(ftok.arr) > 0
         AND ptok.arr && ftok.arr
         AND (f.style_id IS NULL OR p.style_id IS NULL OR lower(btrim(p.style_id)) = lower(btrim(f.style_id)))
         AND p.created_at > f.created_at
       ORDER BY p.created_at DESC
       LIMIT 1
     ) p ON true
     WHERE f.result = 'not_approved'
     ORDER BY f.created_at DESC`
  );

  const shape = (r, passed) => {
    const { passed_id, passed_type, passed_style_id, passed_date_from, passed_date_to, passed_created_at, passed_matched_po, ...rest } = r;
    return { ...rest, passed: passed_id ? passed(r) : null };
  };
  return {
    inspections: inspections.rows.map((r) => shape(r, (x) => ({
      id: x.passed_id, type: x.passed_type, date_from: x.passed_date_from, date_to: x.passed_date_to, created_at: x.passed_created_at, matched_po: x.passed_matched_po,
    }))),
    pp_samples: ppSamples.rows.map((r) => shape(r, (x) => ({
      id: x.passed_id, style_id: x.passed_style_id, created_at: x.passed_created_at, matched_po: x.passed_matched_po,
    }))),
  };
}

async function summary(req, res) {
  const pp = await pool.query(
    `SELECT ps.id, ps.style_id, ps.po_number, ps.result, ps.created_at,
            s.name AS supplier_name, s.name_zh AS supplier_name_zh
     FROM pp_samples ps JOIN suppliers s ON s.id = ps.supplier_id
     ORDER BY ps.created_at DESC LIMIT 5`
  );

  const inspections = await pool.query(
    `SELECT i.id, i.po_number, i.type, i.result, i.date_from, i.date_to,
            i.total_order_qty, i.total_inspected, i.created_at,
            s.name AS supplier_name, s.name_zh AS supplier_name_zh,
            COALESCE((SELECT SUM(pcs_found) FROM inspection_issues WHERE inspection_id = i.id), 0)::int AS with_issues
     FROM inspections i JOIN suppliers s ON s.id = i.supplier_id
     ORDER BY i.created_at DESC LIMIT 5`
  );

  // most recent inspection per factory -> "recently visited" with its date range
  const recent = await pool.query(
    `SELECT DISTINCT ON (i.supplier_id)
            i.supplier_id, i.date_from, i.date_to, i.created_at,
            s.name AS supplier_name, s.name_zh AS supplier_name_zh
     FROM inspections i JOIN suppliers s ON s.id = i.supplier_id
     ORDER BY i.supplier_id, i.created_at DESC`
  );
  const recently_visited = recent.rows
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  res.json({
    latest_pp_samples: pp.rows,
    latest_inspections: inspections.rows,
    recently_visited,
    failed_entries: await failedEntries(),
  });
}

module.exports = { summary };
