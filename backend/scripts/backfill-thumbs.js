/* One-off: generate missing thumbnails for every photo already in the uploads
   volume. Safe to re-run (skips existing thumbs). Run inside the app container:
     docker exec qc_app node scripts/backfill-thumbs.js
*/
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { ensureThumb, thumbPathFor, isThumbPath, resolvePath } = require('../src/services/photoStorage');

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

(async () => {
  const root = path.resolve(config.uploadsDir);
  const files = walk(root, []).map((abs) => path.relative(root, abs).split(path.sep).join('/'));
  let made = 0, skipped = 0, failed = 0;
  const started = Date.now();
  for (const rel of files) {
    if (isThumbPath(rel) || !/\.(jpe?g|png|webp)$/i.test(rel)) continue;
    if (fs.existsSync(resolvePath(thumbPathFor(rel)))) { skipped++; continue; }
    try {
      await ensureThumb(rel);
      made++;
    } catch (e) {
      failed++;
      console.error('failed:', rel, e.message);
    }
  }
  console.log(`thumbnails: made ${made}, already had ${skipped}, failed ${failed} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
})();
