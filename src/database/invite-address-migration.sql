-- Add society address to invites (optional; used when creating invite and pre-filled on onboarding)
-- Run once. If column already exists, this will error (safe to skip).
ALTER TABLE society_invites ADD COLUMN address TEXT DEFAULT NULL AFTER monthly_fee;
