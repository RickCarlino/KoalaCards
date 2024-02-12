-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" INTEGER NOT NULL,
    "quizType" TEXT NOT NULL,
    "stability" REAL NOT NULL,
    "difficulty" REAL NOT NULL,
    "firstReview" REAL NOT NULL,
    "lastReview" REAL NOT NULL,
    "nextReview" REAL NOT NULL,
    "lapses" REAL NOT NULL DEFAULT 0,
    "repetitions" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Quiz_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("cardId", "firstReview", "id", "lapses", "lastReview", "nextReview", "quizType", "repetitions", "difficulty", "stability") SELECT "cardId", "firstReview", "id", "lapses", "lastReview", "nextReview", "quizType", "repetitions", "difficulty", "stability" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE UNIQUE INDEX "Quiz_cardId_quizType_key" ON "Quiz"("cardId", "quizType");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
