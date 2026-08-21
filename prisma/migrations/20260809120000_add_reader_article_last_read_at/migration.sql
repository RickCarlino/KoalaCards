ALTER TABLE "ReaderArticle"
ADD COLUMN "lastReadAt" TIMESTAMP(3);

UPDATE "ReaderArticle"
SET "lastReadAt" = "readAt"
WHERE "readAt" IS NOT NULL;

CREATE INDEX "ReaderArticle_userId_lastReadAt_idx"
ON "ReaderArticle"("userId", "lastReadAt");
