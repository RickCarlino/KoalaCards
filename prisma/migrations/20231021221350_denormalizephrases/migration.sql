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
    "term" TEXT,
    "definition" TEXT,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Insert records into the new temporary table with joined data
INSERT INTO "new_Card" 
    ("ease", "flagged", "id", "interval", "lapses", "nextReviewAt", "phraseId", "repetitions", "userId", "term", "definition")
SELECT 
    c."ease", c."flagged", c."id", c."interval", c."lapses", c."nextReviewAt", c."phraseId", c."repetitions", c."userId", p."term", p."definition"
FROM "Card" c
LEFT JOIN "phrase" p ON c."phraseId" = p."id";

-- Drop the original Card table
DROP TABLE "Card";

ALTER TABLE "new_Card" RENAME TO "Card";

CREATE UNIQUE INDEX "Card_term_key" ON "Card"("term");
CREATE UNIQUE INDEX "Card_userId_term_key" ON "Card"("userId", "term");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
