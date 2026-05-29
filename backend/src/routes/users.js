const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/usersController');

router.use(requireAuth, requireAdmin);
router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.patch('/:id', asyncHandler(c.update));

module.exports = router;
