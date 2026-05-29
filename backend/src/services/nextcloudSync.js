const config = require('../config');

// Optional WebDAV mirror of photos into QC-Reports/YYYY-MM/{Factory}/.
// Disabled unless NEXTCLOUD_URL/USER/PASSWORD are all set. Best-effort,
// never blocks or fails the main request.

function davBase() {
  return `${config.nextcloud.url}/remote.php/dav/files/${encodeURIComponent(config.nextcloud.user)}`;
}
function authHeader() {
  return 'Basic ' + Buffer.from(`${config.nextcloud.user}:${config.nextcloud.password}`).toString('base64');
}

async function mkcol(url) {
  try {
    await fetch(url, { method: 'MKCOL', headers: { Authorization: authHeader() } });
  } catch (e) {
    // collection may already exist; ignore
  }
}

async function ensureFolder(parts) {
  let cur = davBase();
  for (const part of parts) {
    cur += '/' + encodeURIComponent(part);
    await mkcol(cur);
  }
  return cur;
}

async function uploadPhoto(buffer, { factory, date, filename }) {
  if (!config.nextcloud.enabled) return;
  const d = date ? new Date(date) : new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const folder = await ensureFolder(['QC-Reports', ym, factory || 'Unknown']);
  const target = `${folder}/${encodeURIComponent(filename)}`;
  const res = await fetch(target, {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  if (![200, 201, 204].includes(res.status)) {
    throw new Error(`WebDAV PUT failed: ${res.status}`);
  }
}

module.exports = { uploadPhoto, enabled: () => config.nextcloud.enabled };
