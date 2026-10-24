const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('../config');
const nextcloud = require('./nextcloudSync');

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/* Thumbnails: every stored photo gets a small JPEG next to it
   (uuid.jpg -> uuid.thumb.jpg) for photo grids; the lightbox and PDF export
   keep using the full-size original. Thumbs are made at upload time and
   lazily on first request for older photos (see ensureThumb). The DB only
   stores the original's file_path; the thumb path is derived from it. */
const THUMB_SUFFIX = '.thumb.jpg';
const THUMB_MAX = 480; // px, longest side — grid cells are ≤ ~200 css px at 2–3× DPR

// Resolve a stored relative path to an absolute path, guarding against traversal.
function resolvePath(relPath) {
  const root = path.resolve(config.uploadsDir);
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error('Invalid upload path');
  }
  return abs;
}

function isThumbPath(relPath) {
  return relPath.endsWith(THUMB_SUFFIX);
}

function thumbPathFor(relPath) {
  return relPath.replace(/\.[^./]+$/, '') + THUMB_SUFFIX;
}

async function makeThumb(absSrc, absThumb) {
  // write to a temp file first so a concurrent request never sees a half-written thumb
  const tmp = absThumb.replace(/\.jpg$/, `.${process.pid}.${Date.now()}.tmp.jpg`);
  try {
    await sharp(absSrc)
      .rotate() // honour EXIF orientation
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(tmp);
    await fsp.rename(tmp, absThumb);
  } catch (e) {
    try { await fsp.unlink(tmp); } catch (_) { /* nothing to clean */ }
    throw e;
  }
}

// Absolute path of the thumbnail for a stored photo, generating it on first use.
// Returns null when the original is missing.
async function ensureThumb(relPath) {
  if (isThumbPath(relPath)) return resolvePath(relPath);
  const absSrc = resolvePath(relPath);
  const absThumb = resolvePath(thumbPathFor(relPath));
  if (fs.existsSync(absThumb)) return absThumb;
  if (!fs.existsSync(absSrc)) return null;
  await makeThumb(absSrc, absThumb);
  return absThumb;
}

// Persist an uploaded photo under uploads/{entity}/{ownerId}/ and (optionally)
// mirror it to Nextcloud. Returns the stored relative file_path.
async function savePhoto({ entity, ownerId, file, nextcloudInfo }) {
  const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const filename = crypto.randomUUID() + ext;
  const absDir = path.join(config.uploadsDir, entity, String(ownerId));
  await fsp.mkdir(absDir, { recursive: true });
  await fsp.writeFile(path.join(absDir, filename), file.buffer);
  const filePath = path.posix.join(entity, String(ownerId), filename);

  // thumbnail failure must never block the upload itself
  try {
    await ensureThumb(filePath);
  } catch (e) {
    console.error('[thumb] failed for', filePath, e.message);
  }

  if (nextcloud.enabled() && nextcloudInfo) {
    nextcloud
      .uploadPhoto(file.buffer, { ...nextcloudInfo, filename })
      .catch((e) => console.error('[nextcloud] photo sync failed:', e.message));
  }
  return filePath;
}

async function removePhoto(relPath) {
  for (const p of [relPath, thumbPathFor(relPath)]) {
    try {
      await fsp.unlink(resolvePath(p));
    } catch (e) {
      /* already gone */
    }
  }
}

module.exports = { savePhoto, removePhoto, resolvePath, ensureThumb, thumbPathFor, isThumbPath };
