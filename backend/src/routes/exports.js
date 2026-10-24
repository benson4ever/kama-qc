/* PDF export routes — kept separate from the CRUD routers so the feature can
   grow (new report types, options) without touching existing files. */
const router = require('express').Router();
const { asyncHandler, httpError } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const inspections = require('../controllers/inspectionsController');
const ppSamples = require('../controllers/ppSamplesController');
const inspectionReport = require('../services/pdf/inspectionReport');
const ppSampleReport = require('../services/pdf/ppSampleReport');

const safeName = (s) => String(s || 'report').replace(/[^\w.-]+/g, '_').slice(0, 60);
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'undated');

router.use(requireAuth);

router.get('/inspections/:id/pdf', asyncHandler(async (req, res) => {
  const insp = await inspections.withDetail(req.params.id);
  if (!insp) throw httpError(404, 'Inspection not found');
  const date = isoDate(insp.date_from || insp.created_at);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="KamaQC_Inspection_${safeName(insp.po_number)}_${date}.pdf"`);
  await inspectionReport.render(insp, res);
}));

router.get('/pp-samples/:id/pdf', asyncHandler(async (req, res) => {
  const sample = await ppSamples.withDetail(req.params.id);
  if (!sample) throw httpError(404, 'PP sample not found');
  const date = isoDate(sample.created_at);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="KamaQC_PPSample_${safeName(sample.style_id || sample.po_number)}_${date}.pdf"`);
  await ppSampleReport.render(sample, res);
}));

module.exports = router;
