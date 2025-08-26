-- Rename TrainingSample -> QuizResult and preserve indexes
DO $$
BEGIN
  IF to_regclass('"TrainingSample"') IS NOT NULL AND to_regclass('"QuizResult"') IS NULL THEN
    ALTER TABLE "TrainingSample" RENAME TO "QuizResult";
  END IF;

  IF to_regclass('"QuizResult"') IS NOT NULL THEN
    -- Recreate helpful indexes under new names (no-op if already exist)
    CREATE INDEX IF NOT EXISTS quiz_result_created_idx ON "QuizResult" ("createdAt");
    CREATE INDEX IF NOT EXISTS quiz_result_lang_created_idx ON "QuizResult" ("langCode", "createdAt");
    CREATE INDEX IF NOT EXISTS quiz_result_user_created_idx ON "QuizResult" ("userId", "createdAt");
    CREATE INDEX IF NOT EXISTS quiz_result_user_lang_created_idx ON "QuizResult" ("userId", "langCode", "createdAt");
  END IF;
END $$;

