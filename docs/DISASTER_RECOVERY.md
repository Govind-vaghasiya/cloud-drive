# Cloud Drive Disaster Recovery & Volume Restoration Runbook

This document details the recovery procedure for Cloud Drive in the event of server failure, database corruption, or storage volume migration.

---

## 1. Architecture Overview & Backup Components

Cloud Drive consists of three stateful elements that must be preserved:

| Component | Storage Location | Backup Method | Recovery Target |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | `cloud_drive_postgres_data` | Daily `.sql.gz` dump to `cloud_drive_postgres_backups` | Restored via `psql` / `zcat` |
| **Encrypted Storage** | `cloud_drive_file_storage` (`/app/data/storage`) | Volume snapshot / rsync / cold copy | Reattached as Docker volume |
| **Server Master Key** | `MASTER_ENCRYPTION_KEY` in `.env` | Secure off-site password vault | Required to decrypt all file keys |

> [!CAUTION]
> **CRITICAL REQUIREMENT**: The `MASTER_ENCRYPTION_KEY` in `.env` is required to unwrap all per-file AES-256-GCM encryption keys. Without this key, stored `.enc` files cannot be decrypted even if you restore the database! Always back up `.env` to a secure off-site password manager.

---

## 2. Restoring PostgreSQL Database from Backup

### Step 2.1: List Available Backups
View backup dumps in the backup volume or container:
```bash
docker exec -it cloud_drive_db_backup ls -lh /backups
```
You will see files formatted as `cloud_drive_backup_YYYYMMDD_HHMMSS.sql.gz`.

### Step 2.2: Perform Database Restoration
To restore the latest backup into a running PostgreSQL container:

```bash
# 1. Stop backend services to avoid concurrent writes
docker compose stop app

# 2. Drop and recreate clean database schema
docker exec -it cloud_drive_postgres psql -U cloud_drive_user -d postgres -c "DROP DATABASE IF EXISTS cloud_drive;"
docker exec -it cloud_drive_postgres psql -U cloud_drive_user -d postgres -c "CREATE DATABASE cloud_drive OWNER cloud_drive_user;"

# 3. Restore the chosen gzipped dump into PostgreSQL
# (Replace the backup filename with your desired backup timestamp)
docker exec -i cloud_drive_postgres /bin/sh -c "zcat /backups/cloud_drive_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U cloud_drive_user -d cloud_drive"

# 4. Restart backend app
docker compose start app
```

---

## 3. Storage Volume Migration & Reattachment

If migrating to a new physical server or disk:

### Step 3.1: Export File Storage Data
On the old server:
```bash
docker run --rm -v cloud_drive_file_storage:/data -v $(pwd):/backup alpine \
  tar czf /backup/storage_files_backup.tar.gz -C /data .
```

### Step 3.2: Import File Storage Data
On the new server:
```bash
# Create volume if not already existing
docker volume create cloud_drive_file_storage

# Extract storage archive into volume
docker run --rm -v cloud_drive_file_storage:/data -v $(pwd):/backup alpine \
  tar xzf /backup/storage_files_backup.tar.gz -C /data
```

---

## 4. Production Domain & SSL Verification (`drive2.govindvaghasiya.ca`)

### Step 4.1: Cloudflare Tunnel & DNS Health
1. Verify DNS `CNAME` for `drive2.govindvaghasiya.ca` points to your Cloudflare Tunnel UUID.
2. Confirm Cloudflare SSL/TLS encryption mode is set to **Full** or **Full (Strict)**.
3. Test public HTTPS access and certificate validity:
   ```bash
   curl -Iv https://drive2.govindvaghasiya.ca/health
   ```

### Step 4.2: Verify Caddy Reverse Proxy
Inspect Caddy live container logs:
```bash
docker compose logs -f caddy
```

---

## 5. Emergency Recovery Checklist

- [ ] `.env` loaded with correct `MASTER_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, and `ONLYOFFICE_JWT_SECRET`.
- [ ] Database restored and verified with `SELECT count(*) FROM "user";`.
- [ ] Storage volume attached at `/app/data/storage` with `files/` and `thumbnails/` subdirectories.
- [ ] Redis container healthy (`redis-cli ping` returns `PONG`).
- [ ] Backend health check responds `{"status":"ok"}` on `/health`.
- [ ] OnlyOffice container responds on `/onlyoffice/healthcheck`.
