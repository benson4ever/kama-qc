/* Factory inspection report PDF. Takes the same detail object the API's
   GET /inspections/:id returns and streams a finished PDF to `out`. */
const L = require('./layout');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const fmtRange = (from, to) => {
  const f = fmtDate(from); const t = fmtDate(to);
  if (f && t) return `${f} – ${t}`;
  return f || t || '—';
};
const pctOf = (n, base) => (base ? `${((n / base) * 100).toFixed(2)}%` : '—');

const issueName = (it) => (it.defect_id
  ? [it.defect_name_zh, it.defect_name_en].filter(Boolean).join(' ')
  : (it.custom_description || 'Other issue'));

const issueBadgeKind = (it) => (it.defect_classification === 'major' ? 'fail'
  : it.defect_classification === 'minor' ? 'minor' : 'muted');

/* Defects two per row. Photo buffers are prepared up front; each cell shows
   its issue name, pcs badge and photos in a 2-column mini grid. A row breaks
   to a new page as a unit; an issue too tall for that falls back to full width. */
async function renderIssuesTwoUp(doc, items) {
  const prepared = [];
  for (const it of items) {
    const bufs = [];
    for (const p of it.photos || []) {
      const b = await L.preparePhoto(p.file_path);
      if (b) bufs.push(b);
    }
    prepared.push({ it, bufs });
  }

  const gap = 14;
  const cellW = (L.contentWidth(doc) - gap) / 2;
  const photoGap = 6;
  const photoW = (cellW - photoGap) / 2;
  const usableH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 10;

  const measure = (e) => {
    doc.font('body').fontSize(9);
    const nameH = doc.heightOfString(issueName(e.it), { width: cellW - 55 });
    const rows = Math.ceil(e.bufs.length / 2);
    return Math.max(nameH, 15) + (rows ? 5 + rows * (photoW + photoGap) : 4) + 8;
  };

  const drawCell = (e, x, top) => {
    const badgeText = `${e.it.pcs_found} pcs`;
    doc.font('bold').fontSize(8);
    const bw = doc.widthOfString(badgeText) + 12;
    L.badge(doc, badgeText, issueBadgeKind(e.it), x + cellW - bw, top);
    doc.font('body').fontSize(9).fillColor(L.C.ink)
      .text(issueName(e.it), x, top, { width: cellW - bw - 8 });
    let y = Math.max(doc.y, top + 15) + 5;
    e.bufs.forEach((b, k) => {
      if (k > 0 && k % 2 === 0) y += photoW + photoGap;
      const px = x + (k % 2) * (photoW + photoGap);
      doc.image(b, px, y, { fit: [photoW, photoW], align: 'center', valign: 'center' });
    });
  };

  let i = 0;
  while (i < prepared.length) {
    const a = prepared[i];
    const hA = measure(a);
    if (hA > usableH) {
      // too tall for a half-width cell: full width, photos flow row by row
      L.ensureSpace(doc, 40);
      const y = doc.y;
      const badgeText = `${a.it.pcs_found} pcs`;
      doc.font('bold').fontSize(8);
      const bw = doc.widthOfString(badgeText) + 12;
      L.badge(doc, badgeText, issueBadgeKind(a.it), doc.page.width - doc.page.margins.right - bw, y);
      doc.font('body').fontSize(10).fillColor(L.C.ink)
        .text(issueName(a.it), L.left(doc), y, { width: L.contentWidth(doc) - bw - 10 });
      await L.photoGrid(doc, a.it.photos);
      doc.moveDown(0.4);
      i += 1;
      continue;
    }
    const b = i + 1 < prepared.length && measure(prepared[i + 1]) <= usableH ? prepared[i + 1] : null;
    const rowH = Math.max(hA, b ? measure(b) : 0);
    L.ensureSpace(doc, rowH);
    const top = doc.y;
    drawCell(a, L.left(doc), top);
    if (b) drawCell(b, L.left(doc) + cellW + gap, top);
    doc.x = L.left(doc);
    doc.y = top + rowH;
    i += b ? 2 : 1;
  }
}

async function render(insp, out) {
  const doc = L.createDoc(`Inspection ${insp.po_number || ''}`.trim());
  doc.pipe(out);

  const resultText = insp.result === 'pass' ? 'Pass' : 'Fail';
  L.header(doc, {
    reportType: 'Factory inspection report',
    title: insp.supplier_name + (insp.supplier_name_zh ? ` ${insp.supplier_name_zh}` : ''),
    subtitle: `${insp.type === 'inline' ? 'Inline' : 'Final'} inspection`,
    badgeText: resultText,
    badgeKind: insp.result === 'pass' ? 'pass' : 'fail',
  });

  const sumPcs = (arr) => arr.reduce((n, x) => n + (x.pcs_found || 0), 0);
  const majors = insp.issues.filter((x) => x.defect_classification === 'major');
  const minors = insp.issues.filter((x) => x.defect_classification === 'minor');
  const inspected = insp.total_inspected;

  L.fieldGrid(doc, [
    ['PO number', insp.po_number || '—'],
    ['Inspection dates', fmtRange(insp.date_from, insp.date_to)],
    ['Recorded', `${fmtDate(insp.created_at) || '—'}${insp.created_by_name ? ` · ${insp.created_by_name}` : ''}`],
    ['Result', resultText],
    ['Total order qty', insp.total_order_qty != null ? insp.total_order_qty : '—'],
    ['Total pcs inspected', inspected != null ? inspected : '—'],
    ['Pcs with issues', insp.with_issues],
    ['Of order inspected', insp.total_order_qty && inspected != null ? pctOf(inspected, insp.total_order_qty) : '—'],
    ['Major defect % of inspected', pctOf(sumPcs(majors), inspected)],
    ['Minor defect % of inspected', pctOf(sumPcs(minors), inspected)],
    ['Total defect % of inspected', pctOf(sumPcs(insp.issues), inspected)],
  ]);

  if (insp.comment) {
    L.section(doc, 'Comment');
    L.paragraph(doc, insp.comment);
  }

  // photos attached directly to the inspection, split by kind
  const byKind = { product: [], measurement: [], packaging: [] };
  const byProduct = {};
  for (const p of insp.photos || []) {
    if (p.kind === 'measurement') byKind.measurement.push(p);
    else if (p.kind === 'packaging') byKind.packaging.push(p);
    else if (p.product_id) (byProduct[p.product_id] ||= []).push(p);
    else byKind.product.push(p);
  }
  const sideCaption = (p) => p.caption || (p.kind === 'product_front' ? 'Front' : p.kind === 'product_back' ? 'Back' : '');

  const products = insp.products || [];
  if (products.length || byKind.product.length) {
    L.section(doc, 'Products', 220); // keep title with a product name + first photo row
    for (let i = 0; i < products.length; i++) {
      const ph = (byProduct[products[i].id] || []).map((p) => ({ ...p, caption: sideCaption(p) }));
      L.ensureSpace(doc, ph.length ? 200 : 24); // product name never orphaned from its photos
      doc.font('bold').fontSize(10).fillColor(L.C.ink)
        .text(products[i].product_ref || `Product ${i + 1}`, L.left(doc), doc.y, { width: L.contentWidth(doc) });
      await L.photoGrid(doc, ph);
      doc.moveDown(0.4);
    }
    if (byKind.product.length) {
      await L.photoGrid(doc, byKind.product.map((p) => ({ ...p, caption: sideCaption(p) })));
    }
  }

  L.section(doc, `Defects logged (${insp.issues.length})`, 160);
  if (!insp.issues.length) L.paragraph(doc, 'No defects logged.');
  const groups = [
    ['Major 主要', majors],
    ['Minor 次要', minors],
    ['Other issues', insp.issues.filter((x) => !x.defect_classification)],
  ];
  for (const [label, items] of groups) {
    if (!items.length) continue;
    L.ensureSpace(doc, 210); // group label stays with its first defect row (~160pt + label)
    doc.moveDown(0.3);
    doc.font('bold').fontSize(9).fillColor(L.C.muted).text(label, L.left(doc));
    doc.moveDown(0.3);
    await renderIssuesTwoUp(doc, items);
  }

  if (byKind.packaging.length) {
    L.section(doc, 'Packaging', 220); // title + first photo row stay together
    await L.photoGrid(doc, byKind.packaging);
  }
  if (byKind.measurement.length) {
    L.section(doc, 'Measurements', 220);
    await L.photoGrid(doc, byKind.measurement);
  }

  L.finalize(doc);
}

module.exports = { render };
