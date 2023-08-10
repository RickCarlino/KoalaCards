/*
  Warnings:

  - Added the required column `root_word` to the `Phrase` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phrase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "root_word" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Phrase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Phrase" ("definition", "id", "term", "userId") SELECT "definition", "id", "term", "userId" FROM "Phrase";
DROP TABLE "Phrase";
ALTER TABLE "new_Phrase" RENAME TO "Phrase";
CREATE UNIQUE INDEX "Phrase_term_key" ON "Phrase"("term");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
