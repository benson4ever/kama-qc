/* PP sample report PDF. Takes the same detail object the API's
   GET /pp-samples/:id returns and streams a finished PDF to `out`. */
const L = require('./layout');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

async function render(sample, out) {
  const doc = L.createDoc(`PP sample ${sample.style_id || sample.po_number || ''}`.trim());
  doc.pipe(out);

  const approved = sample.result === 'approved';
  L.header(doc, {
    reportType: 'PP sample report',
    title: sample.supplier_name + (sample.supplier_name_zh ? ` ${sample.supplier_name_zh}` : ''),
    subtitle: sample.style_id ? `Style ID ${sample.style_id}` : null,
    badgeText: approved ? 'Approved' : 'Not approved',
    badgeKind: approved ? 'pass' : 'fail',
  });

  L.fieldGrid(doc, [
    ['PO number', sample.po_number || '—'],
    ['Style ID', sample.style_id || '—'],
    ['Style / 款式', sample.fit || '—'],
    ['Result', approved ? 'Approved' : 'Not approved'],
    ['Recorded', `${fmtDate(sample.created_at) || '—'}${sample.created_by_name ? ` · ${sample.created_by_name}` : ''}`],
  ]);

  if (sample.issues_text || sample.comment) {
    L.section(doc, 'Comments / issues found');
    if (sample.issues_text) L.paragraph(doc, sample.issues_text);
    if (sample.comment) { doc.moveDown(0.4); L.paragraph(doc, sample.comment); }
  }

  if ((sample.photos || []).length) {
    L.section(doc, `Photos (${sample.photos.length})`, 220); // title + first photo row stay together
    await L.photoGrid(doc, sample.photos);
  }

  L.finalize(doc);
}

module.exports = { render };
