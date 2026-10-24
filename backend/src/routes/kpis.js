const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/kpiController');

router.use(requireAuth);
router.get('/', asyncHandler(c.kpis));

module.exports = router;
