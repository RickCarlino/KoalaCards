/*
  Warnings:

  - A unique constraint covering the columns `[cardId,quizType]` on the table `Quiz` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Quiz_cardId_quizType_key" ON "Quiz"("cardId", "quizType");
