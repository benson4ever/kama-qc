/* Dashboard KPIs over the last 3 calendar months. Kept separate from the
   dashboard summary so the feature can grow without touching existing code.
   An inspection is dated by its inspection date, falling back to creation.
   Everything is computed separately per inspection type (inline / final):
   an inline fail is normally followed by a final inspection of the same
   pieces, so mixing the two would count the same goods twice and inflate
   the defect rate.
   The supplier "fails" figure counts only OPEN fails: a fail that a later
   pass on the same supplier + PO has cleared (same token rule as the
   dashboard's Failed panel, see db/poMatch.js) is not counted. */
const { pool } = require('../db/pool');
const { PO_TOKENS, LATER_PASS_EXISTS } = require('../db/poMatch');

const PERIOD_ANY = `COALESCE(i.date_from::timestamptz, i.created_at) >= date_trunc('month', now()) - interval '2 months'`;
const PERIOD = `${PERIOD_ANY} AND i.type = $1`;

// Top defect types across both inspection types, with the pcs split per type
// so the dashboard can show inline and final side by side on one bar.
async function topDefectsCombined() {
  const { rows } = await pool.query(
    `SELECT COALESCE(d.id::text, 'other') AS key,
            COALESCE(d.name_en, 'Other issues') AS name_en,
            d.name_zh,
            COALESCE(d.classification, 'other') AS classification,
            COALESCE(SUM(ii.pcs_found) FILTER (WHERE i.type = 'inline'), 0)::int AS inline_pcs,
            COALESCE(SUM(ii.pcs_found) FILTER (WHERE i.type = 'final'), 0)::int AS final_pcs,
            SUM(ii.pcs_found)::int AS pcs
     FROM inspection_issues ii
     JOIN inspections i ON i.id = ii.inspection_id
     LEFT JOIN defects d ON d.id = ii.defect_id
     WHERE ${PERIOD_ANY} AND ii.pcs_found > 0
     GROUP BY 1, 2, 3, 4
     ORDER BY pcs DESC
     LIMIT 8`
  );
  return rows;
}

async function kpisFor(type) {
  const trend = await pool.query(
    `WITH m AS (
       SELECT generate_series(
         date_trunc('month', now()) - interval '2 months',
         date_trunc('month', now()), interval '1 month') AS month
     ),
     vol AS (
       SELECT date_trunc('month', COALESCE(i.date_from::timestamptz, i.created_at)) AS mo,
              SUM(i.total_inspected) AS pcs, COUNT(*) AS inspections
       FROM inspections i WHERE ${PERIOD} GROUP BY 1
     ),
     def AS (
       SELECT date_trunc('month', COALESCE(i.date_from::timestamptz, i.created_at)) AS mo,
              SUM(CASE WHEN d.classification = 'major' THEN ii.pcs_found ELSE 0 END) AS major_pcs,
              SUM(CASE WHEN d.classification = 'minor' THEN ii.pcs_found ELSE 0 END) AS minor_pcs,
              SUM(CASE WHEN ii.defect_id IS NULL THEN ii.pcs_found ELSE 0 END) AS other_pcs
       FROM inspection_issues ii
       JOIN inspections i ON i.id = ii.inspection_id
       LEFT JOIN defects d ON d.id = ii.defect_id
       WHERE ${PERIOD} GROUP BY 1
     )
     SELECT to_char(m.month, 'YYYY-MM') AS month,
            COALESCE(vol.pcs, 0)::int AS pcs,
            COALESCE(vol.inspections, 0)::int AS inspections,
            COALESCE(def.major_pcs, 0)::int AS major_pcs,
            COALESCE(def.minor_pcs, 0)::int AS minor_pcs,
            COALESCE(def.other_pcs, 0)::int AS other_pcs
     FROM m
     LEFT JOIN vol ON vol.mo = m.month
     LEFT JOIN def ON def.mo = m.month
     ORDER BY m.month`,
    [type]
  );

  const suppliers = await pool.query(
    `SELECT s.id, s.name, s.name_zh,
            COUNT(i.id)::int AS inspections,
            COUNT(*) FILTER (WHERE i.result = 'fail' AND NOT ${LATER_PASS_EXISTS('i', 'itok')})::int AS fails,
            COALESCE(SUM(i.total_inspected), 0)::int AS pcs,
            COALESCE(dd.defect_pcs, 0)::int AS defect_pcs
     FROM inspections i
     JOIN suppliers s ON s.id = i.supplier_id
     CROSS JOIN LATERAL (SELECT ${PO_TOKENS('i.po_number')} AS arr) itok
     LEFT JOIN (
       SELECT i.supplier_id, SUM(ii.pcs_found) AS defect_pcs
       FROM inspection_issues ii JOIN inspections i ON i.id = ii.inspection_id
       WHERE ${PERIOD} GROUP BY 1
     ) dd ON dd.supplier_id = s.id
     WHERE ${PERIOD}
     GROUP BY s.id, s.name, s.name_zh, dd.defect_pcs
     ORDER BY pcs DESC`,
    [type]
  );

  const topDefects = await pool.query(
    `SELECT COALESCE(d.id::text, 'other') AS key,
            COALESCE(d.name_en, 'Other issues') AS name_en,
            d.name_zh,
            COALESCE(d.classification, 'other') AS classification,
            SUM(ii.pcs_found)::int AS pcs
     FROM inspection_issues ii
     JOIN inspections i ON i.id = ii.inspection_id
     LEFT JOIN defects d ON d.id = ii.defect_id
     WHERE ${PERIOD} AND ii.pcs_found > 0
     GROUP BY 1, 2, 3, 4
     ORDER BY pcs DESC
     LIMIT 8`,
    [type]
  );

  const tiles = trend.rows.reduce((t, r) => ({
    pcs: t.pcs + r.pcs,
    defects: t.defects + r.major_pcs + r.minor_pcs + r.other_pcs,
    inspections: t.inspections + r.inspections,
  }), { pcs: 0, defects: 0, inspections: 0 });

  return { months: trend.rows, suppliers: suppliers.rows, top_defects: topDefects.rows, tiles };
}

async function kpis(req, res) {
  const [inline, final, top_defects] = await Promise.all([kpisFor('inline'), kpisFor('final'), topDefectsCombined()]);
  res.json({ inline, final, top_defects });
}

module.exports = { kpis };
