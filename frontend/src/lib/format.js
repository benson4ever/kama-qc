export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtRange(from, to) {
  if (!from && !to) return '';
  if (from && to) {
    const f = new Date(from); const t = new Date(to);
    const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
    if (sameMonth) return `${f.getDate()} – ${t.getDate()} ${t.toLocaleDateString('en-GB', { month: 'short' })}`;
    return `${fmtDate(from)} – ${fmtDate(to)}`;
  }
  return fmtDate(from || to);
}

export function resultLabel(r) {
  return { approved: 'Approved', not_approved: 'Not approved', pass: 'Pass', fail: 'Fail' }[r] || r;
}
