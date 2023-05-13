-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phrase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ko" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "next_quiz_type" TEXT,
    "last_win_at" DATETIME,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "loss_count" INTEGER NOT NULL DEFAULT 0,
    "win_count" INTEGER NOT NULL DEFAULT 0,
    "win_percentage" REAL NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Phrase" ("en", "id", "ko", "last_win_at", "loss_count", "next_quiz_type", "total_attempts", "win_count", "win_percentage") SELECT "en", "id", "ko", "last_win_at", "loss_count", "next_quiz_type", "total_attempts", "win_count", "win_percentage" FROM "Phrase";
DROP TABLE "Phrase";
ALTER TABLE "new_Phrase" RENAME TO "Phrase";
CREATE UNIQUE INDEX "Phrase_ko_key" ON "Phrase"("ko");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
