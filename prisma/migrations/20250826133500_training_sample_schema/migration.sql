-- Rename TrainingData -> TrainingSample and align columns with usage
DO $$
BEGIN
  -- Only rename table if it exists and new name not taken
  IF to_regclass('"TrainingData"') IS NOT NULL AND to_regclass('"TrainingSample"') IS NULL THEN
    ALTER TABLE "TrainingData" RENAME TO "TrainingSample";
  END IF;

  -- Column renames/additions inside TrainingSample
  IF to_regclass('"TrainingSample"') IS NOT NULL THEN
    -- term -> acceptableTerm
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'term'
    ) THEN
      ALTER TABLE "TrainingSample" RENAME COLUMN "term" TO "acceptableTerm";
    END IF;

    -- explanation -> reason
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'explanation'
    ) THEN
      ALTER TABLE "TrainingSample" RENAME COLUMN "explanation" TO "reason";
    END IF;

    -- Add isAcceptable boolean, backfill from yesNo, then drop yesNo
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'isAcceptable'
    ) THEN
      ALTER TABLE "TrainingSample" ADD COLUMN "isAcceptable" BOOLEAN DEFAULT false NOT NULL;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'TrainingSample' AND column_name = 'yesNo'
      ) THEN
        UPDATE "TrainingSample" SET "isAcceptable" = CASE WHEN "yesNo" = 'yes' THEN TRUE ELSE FALSE END;
        ALTER TABLE "TrainingSample" DROP COLUMN "yesNo";
      END IF;
    END IF;

    -- Drop unused columns if they exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'quizType'
    ) THEN
      ALTER TABLE "TrainingSample" DROP COLUMN "quizType";
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'englishTranslation'
    ) THEN
      ALTER TABLE "TrainingSample" DROP COLUMN "englishTranslation";
    END IF;

    -- Add userId if missing (nullable for now)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'userId'
    ) THEN
      ALTER TABLE "TrainingSample" ADD COLUMN "userId" TEXT;
    END IF;

    -- Add reason column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'reason'
    ) THEN
      ALTER TABLE "TrainingSample" ADD COLUMN "reason" TEXT DEFAULT '' NOT NULL;
    END IF;

    -- Add eventType column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'TrainingSample' AND column_name = 'eventType'
    ) THEN
      ALTER TABLE "TrainingSample" ADD COLUMN "eventType" TEXT DEFAULT 'speaking-judgement' NOT NULL;
    END IF;

    -- Indexes for listing/filtering
    CREATE INDEX IF NOT EXISTS training_sample_created_idx ON "TrainingSample" ("createdAt");
    CREATE INDEX IF NOT EXISTS training_sample_lang_created_idx ON "TrainingSample" ("langCode", "createdAt");
    CREATE INDEX IF NOT EXISTS training_sample_user_created_idx ON "TrainingSample" ("userId", "createdAt");
    CREATE INDEX IF NOT EXISTS training_sample_user_lang_created_idx ON "TrainingSample" ("userId", "langCode", "createdAt");
  END IF;
END $$;
