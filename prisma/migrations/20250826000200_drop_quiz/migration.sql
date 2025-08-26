-- Migration B: Drop the Quiz table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Quiz' OR table_name = 'quiz') THEN
    DROP TABLE "Quiz";
  END IF;
END $$;

