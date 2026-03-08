-- CreateEnum
CREATE TYPE "ReaderIngestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'ERROR');

-- AlterTable
ALTER TABLE "ReaderArticle"
ADD COLUMN "ingestStatus" "ReaderIngestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "ingestError" TEXT NOT NULL DEFAULT '',
ADD COLUMN "ingestStartedAt" TIMESTAMP(3),
ADD COLUMN "ingestedAt" TIMESTAMP(3);

-- Backfill existing reader articles created before queued ingestion.
UPDATE "ReaderArticle"
SET
  "ingestStatus" = 'READY',
  "ingestedAt" = COALESCE("updatedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderArticle_ingestStatus_createdAt_idx" ON "ReaderArticle"("ingestStatus", "createdAt");
