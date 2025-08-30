-- Backfill any NULL helpfulness to 0, set DEFAULT and NOT NULL to align with Prisma schema
UPDATE "QuizResult" SET "helpfulness" = 0 WHERE "helpfulness" IS NULL;
ALTER TABLE "QuizResult" ALTER COLUMN "helpfulness" SET DEFAULT 0;
ALTER TABLE "QuizResult" ALTER COLUMN "helpfulness" SET NOT NULL;

