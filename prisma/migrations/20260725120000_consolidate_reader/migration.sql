ALTER TABLE "UserSettings"
RENAME COLUMN "readerBookFontSize" TO "readerFontSize";

ALTER TABLE "UserSettings"
RENAME COLUMN "readerBookLineHeight" TO "readerLineHeight";

ALTER TABLE "UserSettings"
RENAME COLUMN "readerBookColumnWidth" TO "readerReadingWidth";

DROP TABLE "ReaderBookmarkletCredential";

ALTER TABLE "ReaderArticle"
DROP COLUMN "saveOrigin";

DROP TYPE "ReaderSaveOrigin";

ALTER TABLE "ReaderBook"
DROP COLUMN "targetFormat";

ALTER TABLE "ReaderBookAnnotation"
DROP COLUMN "epubCfi";

ALTER TABLE "ReaderBookProgress"
DROP COLUMN "completedAt";
