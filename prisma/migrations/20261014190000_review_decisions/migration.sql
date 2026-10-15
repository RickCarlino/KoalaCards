ALTER TABLE "QuizResult"
ADD COLUMN "gradingModel" TEXT,
ADD COLUMN "gradingConfidence" DOUBLE PRECISION,
ADD COLUMN "gradingContext" JSONB,
ADD COLUMN "explanation" TEXT,
ADD COLUMN "explanationRequestedAt" TIMESTAMP(3);
