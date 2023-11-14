/*
  Warnings:

  - You are about to drop the column `transcript` on the `Transcript` table. All the data in the column will be lost.
  - Added the required column `value` to the `Transcript` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transcript" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Transcript_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transcript" ("cardId", "grade", "id", "recordedAt") SELECT "cardId", "grade", "id", "recordedAt" FROM "Transcript";
DROP TABLE "Transcript";
ALTER TABLE "new_Transcript" RENAME TO "Transcript";
CREATE UNIQUE INDEX "Transcript_cardId_key" ON "Transcript"("cardId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
