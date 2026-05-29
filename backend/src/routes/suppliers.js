const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/suppliersController');

router.use(requireAuth);
router.get('/', asyncHandler(c.list));
router.post('/', requireAdmin, asyncHandler(c.create));
router.patch('/:id', requireAdmin, asyncHandler(c.update));

module.exports = router;
