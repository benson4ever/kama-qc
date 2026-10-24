const router = require('express').Router();
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/login', asyncHandler(c.login));
router.get('/me', requireAuth, asyncHandler(c.me));
router.post('/change-password', requireAuth, asyncHandler(c.changePassword));
// photo cookie for <img> loads (see middleware/auth.js): refresh at app start, clear on logout
router.post('/photo-session', requireAuth, asyncHandler(c.photoSession));
router.post('/logout', asyncHandler(c.logout));

module.exports = router;
