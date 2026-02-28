/*
  Warnings:

  - Made the column `deckId` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_deckId_fkey";

-- Backfill orphaned cards before enforcing NOT NULL.
INSERT INTO "Deck" ("name", "description", "userId")
SELECT
    'Unsorted',
    'Automatically created to backfill cards that had no deck.',
    missing."userId"
FROM (
    SELECT DISTINCT "userId"
    FROM "Card"
    WHERE "deckId" IS NULL
) AS missing
WHERE NOT EXISTS (
    SELECT 1
    FROM "Deck" d
    WHERE d."userId" = missing."userId"
      AND d."name" = 'Unsorted'
);

UPDATE "Card" c
SET "deckId" = d."id"
FROM "Deck" d
WHERE c."deckId" IS NULL
  AND d."userId" = c."userId"
  AND d."name" = 'Unsorted';

-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "deckId" SET NOT NULL;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TrainingData_pkey'
      AND conrelid = '"QuizResult"'::regclass
  ) THEN
    ALTER TABLE "QuizResult" RENAME CONSTRAINT "TrainingData_pkey" TO "QuizResult_pkey";
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Card_userId_createdAt_idx" ON "Card"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Card_userId_paused_idx" ON "Card"("userId", "paused");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Card_userId_nextReview_idx" ON "Card"("userId", "nextReview");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WritingSubmission_userId_deckId_createdAt_idx" ON "WritingSubmission"("userId", "deckId", "createdAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" DROP CONSTRAINT IF EXISTS "QuizResult_userId_fkey";
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
