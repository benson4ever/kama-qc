/* All dates in the app are ISO (YYYY-MM-DD). */
export function fmtDate(d) {
  if (!d) return '';
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function fmtRange(from, to) {
  if (!from && !to) return '';
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  return fmtDate(from || to);
}

export function resultLabel(r) {
  return { approved: 'Approved', not_approved: 'Not approved', pass: 'Pass', fail: 'Fail' }[r] || r;
}

export function resultBadgeClass(result, type) {
  if (result === 'fail' && type === 'inline') return 'fail-inline';
  return result;
}
