-- CreateTable
CREATE TABLE "Card" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" INTEGER NOT NULL,
    "quizType" TEXT NOT NULL,
    "stability" REAL NOT NULL,
    "retrievability" REAL NOT NULL,
    "firstReview" REAL NOT NULL,
    "lastReview" REAL NOT NULL,
    "nextReview" REAL NOT NULL,
    "lapses" REAL NOT NULL DEFAULT 0,
    "repetitions" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Quiz_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptimizerLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reviewTime" DATETIME NOT NULL,
    "reviewRating" INTEGER NOT NULL,
    "quizId" INTEGER NOT NULL,
    "cardId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_userId_term_key" ON "Card"("userId", "term");
