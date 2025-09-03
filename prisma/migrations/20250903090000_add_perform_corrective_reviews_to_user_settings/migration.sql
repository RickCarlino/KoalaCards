-- AlterTable
-- Add the performCorrectiveReviews flag to UserSettings.
-- Safe on repeat via IF NOT EXISTS.
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "performCorrectiveReviews" BOOLEAN NOT NULL DEFAULT true;

