-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "dailyWritingGoal" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "submission" TEXT NOT NULL,
    "submissionCharacterCount" INTEGER NOT NULL,
    "correction" TEXT NOT NULL,
    "correctionCharacterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WritingSubmission_userId_idx" ON "WritingSubmission"("userId");

-- CreateIndex
CREATE INDEX "WritingSubmission_deckId_idx" ON "WritingSubmission"("deckId");

-- CreateIndex
CREATE INDEX "WritingSubmission_userId_createdAt_idx" ON "WritingSubmission"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
