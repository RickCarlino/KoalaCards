/*
  Warnings:

  - Made the column `deckId` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_deckId_fkey";

-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "deckId" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuizResult" RENAME CONSTRAINT "TrainingData_pkey" TO "QuizResult_pkey";

-- CreateIndex
CREATE INDEX "Card_userId_createdAt_idx" ON "Card"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Card_userId_paused_idx" ON "Card"("userId", "paused");

-- CreateIndex
CREATE INDEX "Card_userId_nextReview_idx" ON "Card"("userId", "nextReview");

-- CreateIndex
CREATE INDEX "WritingSubmission_userId_deckId_createdAt_idx" ON "WritingSubmission"("userId", "deckId", "createdAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
