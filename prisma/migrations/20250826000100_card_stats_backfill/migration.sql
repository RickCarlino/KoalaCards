-- Migration A: Add Card fields defensively, delete non-speaking quizzes, copy speaking stats → Card
-- Safe to run multiple times due to IF NOT EXISTS and idempotent UPDATE semantics.

-- 1) Add columns on Card if missing
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "stability"   DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "difficulty"  DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "firstReview" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "lastReview"  DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "nextReview"  DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "lapses"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "repetitions" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2) Delete any quiz rows that are not "speaking"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Quiz' OR table_name = 'quiz') THEN
    DELETE FROM "Quiz" WHERE "quizType" <> 'speaking';
  END IF;
END $$;

-- 3) Copy stats for speaking quizzes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Quiz' OR table_name = 'quiz') THEN
    UPDATE "Card" c
    SET
      "stability"   = q."stability",
      "difficulty"  = q."difficulty",
      "firstReview" = q."firstReview",
      "lastReview"  = q."lastReview",
      "nextReview"  = q."nextReview",
      "lapses"      = q."lapses",
      "repetitions" = q."repetitions"
    FROM "Quiz" q
    WHERE q."cardId" = c."id" AND q."quizType" = 'speaking';
  END IF;
END $$;

