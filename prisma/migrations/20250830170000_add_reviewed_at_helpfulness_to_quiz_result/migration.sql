-- Add missing columns to align DB with Prisma schema
-- Safe to re-run: uses IF NOT EXISTS

ALTER TABLE "QuizResult"
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "helpfulness" INTEGER NOT NULL DEFAULT 0;

