const fs = require('fs');
const router = require('express').Router();
const { requirePhotoAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { resolvePath, ensureThumb } = require('../services/photoStorage');

/* Serve uploaded photos. Auth is the JWT either as a Bearer header or as the
   qc_photo cookie (set at login / photo-session), so plain <img src> tags can
   load photos directly and the browser can cache them. Filenames are random
   UUIDs and never change, so responses are immutable for a year.
   ?size=thumb serves the small JPEG (generated on first request for older photos). */
const CACHE_CONTROL = 'private, max-age=31536000, immutable';

router.get('/*', requirePhotoAuth, asyncHandler(async (req, res) => {
  const rel = req.params[0];
  let abs;
  try {
    abs = resolvePath(rel);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (req.query.size === 'thumb') {
    try {
      const thumb = await ensureThumb(rel);
      if (thumb) abs = thumb;
    } catch (e) {
      console.error('[thumb] could not generate for', rel, e.message); // fall back to the original
    }
  }
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', CACHE_CONTROL);
  res.sendFile(abs);
}));

module.exports = router;
