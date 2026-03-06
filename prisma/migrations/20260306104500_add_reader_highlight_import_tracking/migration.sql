ALTER TABLE "ReaderArticleHighlight"
ADD COLUMN "importedCardId" INTEGER,
ADD COLUMN "importedAt" TIMESTAMP(3);

CREATE INDEX "ReaderArticleHighlight_importedCardId_idx"
ON "ReaderArticleHighlight"("importedCardId");

ALTER TABLE "ReaderArticleHighlight"
ADD CONSTRAINT "ReaderArticleHighlight_importedCardId_fkey"
FOREIGN KEY ("importedCardId") REFERENCES "Card"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
