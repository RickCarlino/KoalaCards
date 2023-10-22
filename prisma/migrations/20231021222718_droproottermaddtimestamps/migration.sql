/*
  Warnings:

  - You are about to drop the column `root_word` on the `Phrase` table. All the data in the column will be lost.
  - Made the column `definition` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `term` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "phraseId" INTEGER NOT NULL,
    "repetitions" REAL NOT NULL DEFAULT 0,
    "interval" REAL NOT NULL DEFAULT 1,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "lapses" REAL NOT NULL DEFAULT 0,
    "nextReviewAt" REAL NOT NULL DEFAULT 0,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Card" ("definition", "ease", "flagged", "id", "interval", "lapses", "nextReviewAt", "phraseId", "repetitions", "term", "userId") SELECT "definition", "ease", "flagged", "id", "interval", "lapses", "nextReviewAt", "phraseId", "repetitions", "term", "userId" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE UNIQUE INDEX "Card_userId_term_key" ON "Card"("userId", "term");
CREATE TABLE "new_Phrase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Phrase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Phrase" ("definition", "id", "term", "userId") SELECT "definition", "id", "term", "userId" FROM "Phrase";
DROP TABLE "Phrase";
ALTER TABLE "new_Phrase" RENAME TO "Phrase";
CREATE UNIQUE INDEX "Phrase_term_key" ON "Phrase"("term");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
