-- AlterTable
ALTER TABLE "ReaderArticle"
ADD COLUMN "instapaperBookmarkId" VARCHAR(64);

-- CreateIndex
CREATE INDEX "ReaderArticle_userId_instapaperBookmarkId_idx"
ON "ReaderArticle"("userId", "instapaperBookmarkId");
