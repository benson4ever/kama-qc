const { pool } = require('../db/pool');

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
  });
}

module.exports = { summary };
