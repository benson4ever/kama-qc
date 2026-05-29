const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/dashboardController');

router.use(requireAuth);
router.get('/', asyncHandler(c.summary));

module.exports = router;
