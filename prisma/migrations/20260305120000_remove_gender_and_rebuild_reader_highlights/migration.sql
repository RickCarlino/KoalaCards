TRUNCATE TABLE "ReaderArticleHighlight" RESTART IDENTITY;

ALTER TABLE "Card"
DROP COLUMN "gender";

ALTER TABLE "ReaderArticleHighlight"
DROP COLUMN "explanationMarkdown",
ADD COLUMN "term" TEXT NOT NULL DEFAULT '',
ADD COLUMN "definition" TEXT NOT NULL DEFAULT '',
ADD COLUMN "generalMeaning" TEXT NOT NULL DEFAULT '',
ADD COLUMN "meaningInContext" TEXT NOT NULL DEFAULT '';
