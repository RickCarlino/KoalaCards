CREATE TYPE "ReaderInputKind" AS ENUM ('URL', 'RAW');

ALTER TABLE "ReaderArticle"
ADD COLUMN "inputKind" "ReaderInputKind" NOT NULL DEFAULT 'URL';

ALTER TABLE "ReaderArticle"
ALTER COLUMN "requestUrl" DROP NOT NULL,
ALTER COLUMN "normalizedUrl" DROP NOT NULL;
