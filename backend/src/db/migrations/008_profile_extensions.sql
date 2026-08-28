-- Migration 008: Add Profile Extensions (phoneNumber and birthdate) to User table

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "birthdate" TEXT;
