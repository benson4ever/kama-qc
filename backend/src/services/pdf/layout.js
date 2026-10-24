/* Shared PDF building blocks for report exports.
   Self-contained: fonts live in ./fonts, photos are read via photoStorage and
   downscaled with sharp so exports stay a few MB even with many photos.
   Visual language mirrors the app: warm neutrals, colour only for status. */
const PDFDocument = require('pdfkit');
const path = require('path');
const sharp = require('sharp');
const photoStorage = require('../photoStorage');

const C = {
  ink: '#25241F', body: '#4A4842', muted: '#8B877D',
  hairline: '#E2DED4', surface: '#F1EFE9', paper: '#FAF9F6',
  confirm: '#4F7A4A', destruct: '#A2372A', caution: '#E8B33D',
};

const FONTS = {
  body: path.join(__dirname, 'fonts', 'NotoSansCJKsc-Regular.otf'),
  bold: path.join(__dirname, 'fonts', 'NotoSansCJKsc-Bold.otf'),
};

function createDoc(title) {
  const doc = new PDFDocument({
    size: 'A4', margin: 48, bufferPages: true,
    info: { Title: title, Author: 'Kama QC' },
  });
  doc.registerFont('body', FONTS.body);
  doc.registerFont('bold', FONTS.bold);
  doc.font('body').fontSize(10).fillColor(C.body);
  return doc;
}

const left = (doc) => doc.page.margins.left;
const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

function ensureSpace(doc, h) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + h > bottom) doc.addPage();
}

/* Downscale + recompress a stored photo for embedding. Returns null if the
   file is missing or unreadable so a broken photo never kills the export. */
async function preparePhoto(relPath) {
  try {
    const abs = photoStorage.resolvePath(relPath);
    return await sharp(abs)
      .rotate() // respect EXIF orientation
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    return null;
  }
}

function badge(doc, text, kind, x, y) {
  const fills = { pass: C.confirm, fail: C.destruct, minor: C.caution, muted: C.surface };
  const colors = { pass: C.paper, fail: C.paper, minor: C.ink, muted: C.body };
  doc.font('bold').fontSize(8);
  const w = doc.widthOfString(text) + 12;
  const h = 15;
  doc.roundedRect(x, y, w, h, 2).fill(fills[kind] || C.surface);
  doc.fillColor(colors[kind] || C.body).text(text, x + 6, y + 3, { lineBreak: false });
  return w;
}

/* Section title. minKeep reserves room for the title plus the first slice of
   content, so a heading is never orphaned at the bottom of a page. */
function section(doc, title, minKeep = 110) {
  ensureSpace(doc, minKeep);
  doc.moveDown(1);
  doc.font('bold').fontSize(11).fillColor(C.ink).text(title, left(doc));
  const y = doc.y + 2;
  doc.moveTo(left(doc), y).lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.5).strokeColor(C.hairline).stroke();
  doc.x = left(doc);
  doc.y = y + 10;
}

/* Two-column label/value grid. pairs: [[label, value], ...] */
function fieldGrid(doc, pairs, cols = 2) {
  const gap = 16;
  const w = (contentWidth(doc) - gap * (cols - 1)) / cols;
  for (let i = 0; i < pairs.length; i += cols) {
    const row = pairs.slice(i, i + cols);
    doc.font('body').fontSize(10);
    const h = Math.max(...row.map(([, v]) => doc.heightOfString(String(v ?? '—') || '—', { width: w }))) + 13;
    ensureSpace(doc, h + 2);
    const top = doc.y;
    row.forEach(([k, v], j) => {
      const x = left(doc) + j * (w + gap);
      doc.font('body').fontSize(7).fillColor(C.muted).text(k, x, top, { width: w });
      doc.font('body').fontSize(10).fillColor(C.ink).text(String(v ?? '—') || '—', x, top + 10, { width: w });
    });
    doc.x = left(doc);
    doc.y = top + h + 2;
  }
}

function paragraph(doc, text) {
  doc.font('body').fontSize(10).fillColor(C.body)
    .text(text, left(doc), doc.y, { width: contentWidth(doc) });
  doc.x = left(doc);
}

/* Photo grid, 3 per row, captions underneath. photos: [{file_path, caption}] */
async function photoGrid(doc, photos, { cols = 3 } = {}) {
  const items = [];
  for (const p of photos || []) {
    const buf = await preparePhoto(p.file_path);
    if (buf) items.push({ buf, caption: p.caption });
  }
  if (!items.length) return;
  const gap = 8;
  const w = (contentWidth(doc) - gap * (cols - 1)) / cols;
  const imgH = w;
  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols);
    const capH = row.some((r) => r.caption) ? 12 : 0;
    ensureSpace(doc, imgH + capH + 8);
    const top = doc.y;
    row.forEach((r, j) => {
      const x = left(doc) + j * (w + gap);
      doc.image(r.buf, x, top, { fit: [w, imgH], align: 'center', valign: 'center' });
      if (r.caption) {
        doc.font('body').fontSize(7).fillColor(C.muted)
          .text(r.caption, x, top + imgH + 2, { width: w, height: 10, lineBreak: false, ellipsis: true });
      }
    });
    doc.x = left(doc);
    doc.y = top + imgH + capH + 8;
  }
}

/* Report header: small brand line, big title, supplier, status badge on the right. */
function header(doc, { reportType, title, subtitle, generatedFor, badgeText, badgeKind }) {
  const l = left(doc);
  const right = doc.page.width - doc.page.margins.right;
  doc.font('bold').fontSize(9).fillColor(C.muted).text('Kama QC', l, doc.y, { lineBreak: false });
  doc.font('body').fontSize(9).fillColor(C.muted)
    .text(` · ${reportType}`, { lineBreak: false });
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.text(generatedFor ? `${generatedFor} · ${dateStr}` : dateStr, l, doc.y, { width: contentWidth(doc), align: 'right' });
  doc.moveDown(0.6);
  const titleY = doc.y;
  if (badgeText) {
    doc.font('bold').fontSize(8);
    const bw = doc.widthOfString(badgeText) + 12;
    badge(doc, badgeText, badgeKind, right - bw, titleY + 2);
  }
  doc.font('bold').fontSize(16).fillColor(C.ink).text(title, l, titleY, { width: contentWidth(doc) - 90 });
  if (subtitle) doc.font('body').fontSize(10).fillColor(C.muted).text(subtitle, l, doc.y, { width: contentWidth(doc) - 90 });
  const y = doc.y + 8;
  doc.moveTo(l, y).lineTo(right, y).lineWidth(0.5).strokeColor(C.hairline).stroke();
  doc.x = l;
  doc.y = y + 12;
}

/* Page numbers on every page, then close the document. */
function finalize(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // allow writing inside the bottom margin
    doc.font('body').fontSize(7).fillColor(C.muted)
      .text(`Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 28,
        { width: contentWidth(doc), align: 'center', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
  doc.end();
}

module.exports = { C, createDoc, left, contentWidth, ensureSpace, badge, section, fieldGrid, paragraph, photoGrid, preparePhoto, header, finalize };
