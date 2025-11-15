-- Drop langCode from Deck, Card, and QuizResult, and related indexes
DO $$
BEGIN
  -- Explicitly drop known indexes that reference langCode on QuizResult, if present
  IF to_regclass('quiz_result_lang_created_idx') IS NOT NULL THEN
    DROP INDEX quiz_result_lang_created_idx;
  END IF;
  IF to_regclass('quiz_result_user_lang_created_idx') IS NOT NULL THEN
    DROP INDEX quiz_result_user_lang_created_idx;
  END IF;

  -- Drop langCode from Deck
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Deck' AND column_name = 'langCode'
  ) THEN
    ALTER TABLE "Deck" DROP COLUMN "langCode";
  END IF;

  -- Drop langCode from Card
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Card' AND column_name = 'langCode'
  ) THEN
    ALTER TABLE "Card" DROP COLUMN "langCode";
  END IF;

  -- Drop langCode from QuizResult
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'QuizResult' AND column_name = 'langCode'
  ) THEN
    ALTER TABLE "QuizResult" DROP COLUMN "langCode";
  END IF;
END $$;

