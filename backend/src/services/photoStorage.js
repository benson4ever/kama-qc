const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const nextcloud = require('./nextcloudSync');

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Resolve a stored relative path to an absolute path, guarding against traversal.
function resolvePath(relPath) {
  const root = path.resolve(config.uploadsDir);
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error('Invalid upload path');
  }
  return abs;
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

  if (nextcloud.enabled() && nextcloudInfo) {
    nextcloud
      .uploadPhoto(file.buffer, { ...nextcloudInfo, filename })
      .catch((e) => console.error('[nextcloud] photo sync failed:', e.message));
  }
  return filePath;
}

async function removePhoto(relPath) {
  try {
    await fsp.unlink(resolvePath(relPath));
  } catch (e) {
    /* already gone */
  }
}

module.exports = { savePhoto, removePhoto, resolvePath };
