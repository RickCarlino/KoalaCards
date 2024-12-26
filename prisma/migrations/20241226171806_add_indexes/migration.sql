/*
  Warnings:

  - You are about to drop the `RevLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RevLog" DROP CONSTRAINT "RevLog_quizId_fkey";

-- DropTable
DROP TABLE "RevLog";

-- CreateIndex
CREATE INDEX "Card_deckId_idx" ON "Card"("deckId");

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- CreateIndex
CREATE INDEX "Quiz_cardId_idx" ON "Quiz"("cardId");

-- CreateIndex
CREATE INDEX "Quiz_nextReview_idx" ON "Quiz"("nextReview");
