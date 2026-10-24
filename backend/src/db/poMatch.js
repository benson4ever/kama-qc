/* Shared SQL fragments for matching inspections by PO number.

   PO fields may hold several POs ("7219L/7220L", "7176C 7169C 7170C"), so a
   field is split into tokens on spaces, commas, semicolons, slashes, "&" and
   "+" (lower-cased, trimmed). Tokens without a digit are ignored so words like
   "PO" never match. Two entries are "the same PO" when their token arrays
   overlap (Postgres `&&`). Entries without a PO never match anything.

   A fail is "resolved" when a pass for the same supplier and same PO was
   recorded on a later date (inspection date, falling back to creation; same
   day → later created_at). The pass may be of either type: an inline fail is
   normally cleared by a later final inspection. */

// text[] of PO tokens for a column expression, e.g. PO_TOKENS('i.po_number')
const PO_TOKENS = (col) =>
  `(SELECT COALESCE(array_agg(t), '{}') FROM unnest(regexp_split_to_array(lower(btrim(${col})), '[[:space:],;/&+]+')) t WHERE t ~ '[0-9]')`;

// (date, created_at) tuple used to order attempts on the same PO
const ATTEMPT_ORDER = (alias) => `(COALESCE(${alias}.date_from, ${alias}.created_at::date), ${alias}.created_at)`;

/* EXISTS(...) — true when the inspection aliased `f` (whose PO tokens are in
   `${tokAlias}.arr`) has a later passing inspection on the same PO. Use with a
   `CROSS JOIN LATERAL (SELECT ${PO_TOKENS('f.po_number')} AS arr) ftok`. */
const LATER_PASS_EXISTS = (f, tokAlias) =>
  `EXISTS (
     SELECT 1 FROM inspections lp
     CROSS JOIN LATERAL (SELECT ${PO_TOKENS('lp.po_number')} AS arr) lptok
     WHERE lp.supplier_id = ${f}.supplier_id
       AND lp.id <> ${f}.id
       AND lp.result = 'pass'
       AND lptok.arr && ${tokAlias}.arr
       AND ${ATTEMPT_ORDER('lp')} > ${ATTEMPT_ORDER(f)}
   )`;

module.exports = { PO_TOKENS, ATTEMPT_ORDER, LATER_PASS_EXISTS };
