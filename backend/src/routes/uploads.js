const fs = require('fs');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { resolvePath } = require('../services/photoStorage');

// Serve uploaded photos behind auth. Frontend fetches these with the JWT
// and turns the response into an object URL for <img>/lightbox.
router.get('/*', requireAuth, (req, res) => {
  let abs;
  try {
    abs = resolvePath(req.params[0]);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(abs);
});

module.exports = router;
