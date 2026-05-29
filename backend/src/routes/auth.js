const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/login', asyncHandler(c.login));
router.get('/me', requireAuth, asyncHandler(c.me));
router.post('/change-password', requireAuth, asyncHandler(c.changePassword));

module.exports = router;
