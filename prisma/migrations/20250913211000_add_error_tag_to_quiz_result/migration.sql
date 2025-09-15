-- AlterTable
-- Add a short error tag to QuizResult (nullable), capped at 20 chars.
-- Safe on repeat via IF NOT EXISTS.
ALTER TABLE "QuizResult"
  ADD COLUMN IF NOT EXISTS "errorTag" VARCHAR(20);

