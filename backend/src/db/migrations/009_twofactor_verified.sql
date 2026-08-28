-- Migration 009: Add missing 'verified' column to twoFactor table
-- Better Auth's twoFactor plugin requires this column to track TOTP verification status.
-- Without it, enabling 2FA throws: "column 'verified' of relation 'twoFactor' does not exist"

ALTER TABLE "twoFactor"
  ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
