ALTER TABLE "ReaderArticle"
ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "ReaderArticle_userId_readAt_idx"
ON "ReaderArticle"("userId", "readAt");
