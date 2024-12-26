/*
  Warnings:

  - A unique constraint covering the columns `[name,userId]` on the table `Deck` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Deck_name_userId_key" ON "Deck"("name", "userId");
