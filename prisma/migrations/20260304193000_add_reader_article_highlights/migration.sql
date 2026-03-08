-- CreateEnum
CREATE TYPE "ReaderHighlightStatus" AS ENUM ('IN_PROGRESS', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "ReaderArticleHighlight" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" INTEGER NOT NULL,
    "selectedText" TEXT NOT NULL,
    "selectedTextHash" VARCHAR(64) NOT NULL,
    "selectedOccurrenceIndex" INTEGER NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "occurrencesJson" JSONB NOT NULL,
    "articleContentHash" VARCHAR(64) NOT NULL,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ReaderHighlightStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "explanationMarkdown" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderArticleHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReaderArticleHighlight_userId_articleId_createdAt_idx" ON "ReaderArticleHighlight"("userId", "articleId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderArticleHighlight_articleId_createdAt_idx" ON "ReaderArticleHighlight"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderArticleHighlight_cache_key" ON "ReaderArticleHighlight"("userId", "articleId", "selectedTextHash", "selectedOccurrenceIndex", "articleContentHash", "promptVersion");

-- AddForeignKey
ALTER TABLE "ReaderArticleHighlight" ADD CONSTRAINT "ReaderArticleHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderArticleHighlight" ADD CONSTRAINT "ReaderArticleHighlight_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ReaderArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
