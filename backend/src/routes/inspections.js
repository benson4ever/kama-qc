const router = require('express').Router();
const multer = require('multer');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/inspectionsController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);
router.get('/', asyncHandler(c.list));
router.get('/:id', asyncHandler(c.getOne));
router.post('/', asyncHandler(c.create));
router.patch('/:id', asyncHandler(c.update));
router.delete('/:id', asyncHandler(c.remove));

router.post('/:id/issues', asyncHandler(c.addIssue));
router.patch('/:id/issues/:issueId', asyncHandler(c.updateIssue));
router.delete('/:id/issues/:issueId', asyncHandler(c.removeIssue));
router.post('/:id/issues/:issueId/photos', upload.single('photo'), asyncHandler(c.addIssuePhoto));
router.delete('/:id/issues/:issueId/photos/:photoId', asyncHandler(c.deleteIssuePhoto));

module.exports = router;
