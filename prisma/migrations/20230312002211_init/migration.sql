-- CreateTable
CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ko" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "known" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Phrase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ko" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "next_quiz_type" TEXT,
    "last_win_at" DATETIME,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "loss_count" INTEGER NOT NULL DEFAULT 0,
    "win_count" INTEGER NOT NULL DEFAULT 0,
    "win_percentage" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_ko_key" ON "Word"("ko");

-- CreateIndex
CREATE UNIQUE INDEX "Phrase_ko_key" ON "Phrase"("ko");
