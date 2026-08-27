#!/bin/sh
set -e

# ==============================================================================
# Cloud Drive - Automated PostgreSQL Database Backup Script
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cloud_drive}"
DB_USER="${DB_USER:-cloud_drive_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/cloud_drive_backup_${TIMESTAMP}.sql.gz"

echo "==========================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Cloud Drive DB backup..."
echo "Target database: ${DB_NAME} at ${DB_HOST}:${DB_PORT}"
echo "Output destination: ${BACKUP_FILE}"
echo "==========================================================="

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Execute compressed pg_dump
PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${BACKUP_FILE}"

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created! Size: ${BACKUP_SIZE}"

# Prune old backups older than RETENTION_DAYS
echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "cloud_drive_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process complete."
