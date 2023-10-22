/*
  Warnings:

  - You are about to drop the column `phraseId` on the `Card` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "repetitions" REAL NOT NULL DEFAULT 0,
    "interval" REAL NOT NULL DEFAULT 1,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "lapses" REAL NOT NULL DEFAULT 0,
    "nextReviewAt" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstReview" DATETIME,
    "lastReview" DATETIME,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Card" ("createdAt", "definition", "ease", "firstReview", "flagged", "id", "interval", "lapses", "lastReview", "nextReviewAt", "repetitions", "term", "userId") SELECT "createdAt", "definition", "ease", "firstReview", "flagged", "id", "interval", "lapses", "lastReview", "nextReviewAt", "repetitions", "term", "userId" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE UNIQUE INDEX "Card_userId_term_key" ON "Card"("userId", "term");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
