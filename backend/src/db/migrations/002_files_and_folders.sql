-- Migration 002: Folders, Files, Upload Sessions, and Audit Logs

-- Folders Table (Hierarchical tree structure)
CREATE TABLE IF NOT EXISTS "folders" (
    "id" TEXT PRIMARY KEY,
    "parent_id" TEXT REFERENCES "folders"("id") ON DELETE CASCADE,
    "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Files Table (Encrypted metadata and storage references)
CREATE TABLE IF NOT EXISTS "files" (
    "id" TEXT PRIMARY KEY,
    "folder_id" TEXT REFERENCES "folders"("id") ON DELETE SET NULL,
    "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "uuid_storage_name" TEXT NOT NULL UNIQUE,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" BIGINT NOT NULL DEFAULT 0,
    "encryption_key_wrapped" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Resumable Chunked Upload Sessions Table
CREATE TABLE IF NOT EXISTS "upload_sessions" (
    "id" TEXT PRIMARY KEY,
    "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "folder_id" TEXT REFERENCES "folders"("id") ON DELETE SET NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "total_size" BIGINT NOT NULL,
    "uploaded_size" BIGINT NOT NULL DEFAULT 0,
    "encryption_key_wrapped" TEXT NOT NULL,
    "uuid_storage_name" TEXT NOT NULL UNIQUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Audit Logs Table (Tracks sensitive events: upload, download, delete, move, rename)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "resource_id" TEXT,
    "resource_type" TEXT,
    "ip_address" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Query Optimization Indexes
CREATE INDEX IF NOT EXISTS "idx_folders_owner_parent" ON "folders"("owner_id", "parent_id");
CREATE INDEX IF NOT EXISTS "idx_files_owner_folder" ON "files"("owner_id", "folder_id");
CREATE INDEX IF NOT EXISTS "idx_files_uuid" ON "files"("uuid_storage_name");
CREATE INDEX IF NOT EXISTS "idx_upload_sessions_owner" ON "upload_sessions"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);
