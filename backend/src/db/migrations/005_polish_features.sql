-- ==============================================================================
-- Cloud Drive Migration 005: Polish Features (Favorites, Versioning, Full-Text)
-- ==============================================================================

-- 1. Favorites / Starred items support on files and folders
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "is_starred" BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "is_starred" BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_files_starred ON "files"("owner_id", "is_starred") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_starred ON "folders"("owner_id", "is_starred") WHERE "deleted_at" IS NULL;

-- 2. Full-Text Search content field for text/code/document files
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "content_text" TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_files_content_text_gin ON "files" USING gin(to_tsvector('english', coalesce("content_text", '')));

-- 3. File Version History Table
CREATE TABLE IF NOT EXISTS "file_versions" (
    "id" TEXT PRIMARY KEY,
    "file_id" TEXT NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
    "version_number" INTEGER NOT NULL,
    "size" BIGINT NOT NULL,
    "uuid_storage_name" TEXT NOT NULL,
    "encryption_key_wrapped" TEXT NOT NULL,
    "created_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_file_version UNIQUE ("file_id", "version_number")
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON "file_versions"("file_id", "version_number" DESC);
