-- ==============================================================================
-- Cloud Drive Migration 006: One-Time Invite Codes (OTP) for Invite-Only Auth
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "invite_codes" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "created_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "used_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "used_at" TIMESTAMP WITH TIME ZONE NULL,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_lookup ON "invite_codes"("code", "used_at", "expires_at");
