const router = require('express').Router();
const multer = require('multer');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/ppSamplesController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);
router.get('/', asyncHandler(c.list));
router.get('/:id', asyncHandler(c.getOne));
router.post('/', asyncHandler(c.create));
router.patch('/:id', asyncHandler(c.update));
router.delete('/:id', asyncHandler(c.remove));
router.post('/:id/photos', upload.single('photo'), asyncHandler(c.addPhoto));
router.delete('/:id/photos/:photoId', asyncHandler(c.deletePhoto));

module.exports = router;
