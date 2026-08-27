-- Migration 003: Public & Private Sharing System

-- Shares Table
CREATE TABLE IF NOT EXISTS "shares" (
    "id" TEXT PRIMARY KEY,
    "token" TEXT UNIQUE,
    "resource_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL CHECK ("resource_type" IN ('file', 'folder')),
    "type" TEXT NOT NULL CHECK ("type" IN ('public', 'private')),
    "password_hash" TEXT,
    "expires_at" TIMESTAMP WITH TIME ZONE,
    "permission" TEXT NOT NULL DEFAULT 'view' CHECK ("permission" IN ('view', 'edit')),
    "created_by" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Share Recipients Table (Private Shares)
CREATE TABLE IF NOT EXISTS "share_recipients" (
    "id" TEXT PRIMARY KEY,
    "share_id" TEXT NOT NULL REFERENCES "shares"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_share_recipient" UNIQUE ("share_id", "user_id")
);

-- Indexes for Sharing Performance
CREATE INDEX IF NOT EXISTS "idx_shares_token" ON "shares"("token");
CREATE INDEX IF NOT EXISTS "idx_shares_resource" ON "shares"("resource_id", "resource_type");
CREATE INDEX IF NOT EXISTS "idx_shares_creator" ON "shares"("created_by");
CREATE INDEX IF NOT EXISTS "idx_share_recipients_user" ON "share_recipients"("user_id");
CREATE INDEX IF NOT EXISTS "idx_share_recipients_share" ON "share_recipients"("share_id");
