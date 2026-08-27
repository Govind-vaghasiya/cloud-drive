-- Migration 004: Soft Delete Columns for Files and Folders (Trash lifecycle)

-- Add deleted_at column to files table
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at column to folders table
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Query Optimization Indexes for Soft Delete filtering and Trash queries
CREATE INDEX IF NOT EXISTS "idx_files_owner_deleted" ON "files"("owner_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "idx_files_deleted_at" ON "files"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_folders_owner_deleted" ON "folders"("owner_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "idx_folders_deleted_at" ON "folders"("deleted_at");
