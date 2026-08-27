-- ==============================================================================
-- Cloud Drive Migration 007: Extended User Management (Ban, Suspend, Reason)
-- ==============================================================================

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "banReason" TEXT,
ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_user_banned ON "user"("banned");
