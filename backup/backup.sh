#!/usr/bin/env bash
# Kama QC backup: pg_dump + uploads-volume archive, pushed off-server.
# The previous host deleted everything, so an on-server-only backup is worthless.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-qc_postgres}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-kama-qc_qc_uploads}"
LOG="$BACKUP_DIR/backup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# load DB + remote-target settings from .env
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

TS="$(date +%Y%m%d_%H%M%S)"
DB_DUMP="$BACKUP_DIR/db_${TS}.sql.gz"
UP_ARCHIVE="$BACKUP_DIR/uploads_${TS}.tar.gz"

log "=== Backup ${TS} starting ==="

# 1) database
if docker exec "$PG_CONTAINER" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "$DB_DUMP"; then
  log "DB dump  -> $(basename "$DB_DUMP") ($(du -h "$DB_DUMP" | cut -f1))"
else
  log "ERROR: pg_dump failed"; exit 1
fi

# 2) uploaded photos (named volume)
docker run --rm -v "${UPLOADS_VOLUME}:/data:ro" -v "${BACKUP_DIR}:/backup" alpine \
  tar czf "/backup/uploads_${TS}.tar.gz" -C /data . >/dev/null 2>&1 || log "WARN: uploads archive step had issues"
[ -f "$UP_ARCHIVE" ] && log "Uploads  -> $(basename "$UP_ARCHIVE") ($(du -h "$UP_ARCHIVE" | cut -f1))"

# 3) push OFF this server (Nextcloud/WebDAV). Configurable; loud warning if unset.
WEBDAV_URL="${BACKUP_WEBDAV_URL:-${NEXTCLOUD_URL:-}}"
WEBDAV_USER="${BACKUP_WEBDAV_USER:-${NEXTCLOUD_USER:-}}"
WEBDAV_PASS="${BACKUP_WEBDAV_PASSWORD:-${NEXTCLOUD_PASSWORD:-}}"
if [ -n "$WEBDAV_URL" ] && [ -n "$WEBDAV_USER" ] && [ -n "$WEBDAV_PASS" ]; then
  REMOTE="${WEBDAV_URL%/}/remote.php/dav/files/${WEBDAV_USER}/QC-Backups"
  curl -fsS -u "$WEBDAV_USER:$WEBDAV_PASS" -X MKCOL "$REMOTE" >/dev/null 2>&1 || true
  for f in "$DB_DUMP" "$UP_ARCHIVE"; do
    [ -f "$f" ] || continue
    if curl -fsS -u "$WEBDAV_USER:$WEBDAV_PASS" -T "$f" "$REMOTE/$(basename "$f")" >/dev/null; then
      log "Pushed off-server: $(basename "$f")"
    else
      log "WARN: failed to push $(basename "$f") off-server"
    fi
  done
else
  log "################################################################"
  log "# WARNING: No off-server backup target configured.             #"
  log "# Backups are LOCAL-ONLY and will be LOST if this server dies.  #"
  log "# Set BACKUP_WEBDAV_URL/USER/PASSWORD (or NEXTCLOUD_*) in .env. #"
  log "################################################################"
fi

# 4) rotate local copies
find "$BACKUP_DIR" -maxdepth 1 -name 'db_*.sql.gz'      -mtime +"${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads_*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete
log "Rotation done (keep ${RETENTION_DAYS} days). === Backup complete ==="
