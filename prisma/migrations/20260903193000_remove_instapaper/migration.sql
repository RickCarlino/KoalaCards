-- Instapaper had no production users. Delete every locally linked article and
-- credential before removing the integration's schema. Article highlights are
-- deleted by their cascading foreign key. Cards remain because no delete
-- cascade points from a highlight to its Card.
BEGIN;

DELETE FROM "ReaderArticle"
WHERE "instapaperBookmarkId" IS NOT NULL;

DELETE FROM "ReaderInstapaperCredential";

DROP TABLE "ReaderInstapaperCredential";

DROP INDEX "ReaderArticle_userId_instapaperBookmarkId_idx";

ALTER TABLE "ReaderArticle" DROP COLUMN "instapaperBookmarkId";

COMMIT;
