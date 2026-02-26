-- CreateEnum
CREATE TYPE "ReaderSourceLanguage" AS ENUM ('KO', 'EN', 'OTHER');

-- CreateEnum
CREATE TYPE "ReaderSaveOrigin" AS ENUM ('DASHBOARD', 'BOOKMARKLET');

-- CreateTable
CREATE TABLE "ReaderBookmarkletCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" VARCHAR(64) NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderBookmarkletCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderArticle" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "requestUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceLang" "ReaderSourceLanguage" NOT NULL,
    "translated" BOOLEAN NOT NULL DEFAULT false,
    "saveOrigin" "ReaderSaveOrigin" NOT NULL DEFAULT 'DASHBOARD',
    "contentText" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBookmarkletCredential_userId_key" ON "ReaderBookmarkletCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBookmarkletCredential_secretHash_key" ON "ReaderBookmarkletCredential"("secretHash");

-- CreateIndex
CREATE INDEX "ReaderBookmarkletCredential_userId_idx" ON "ReaderBookmarkletCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderArticle_publicId_key" ON "ReaderArticle"("publicId");

-- CreateIndex
CREATE INDEX "ReaderArticle_userId_createdAt_idx" ON "ReaderArticle"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderArticle_publicId_idx" ON "ReaderArticle"("publicId");

-- AddForeignKey
ALTER TABLE "ReaderBookmarkletCredential" ADD CONSTRAINT "ReaderBookmarkletCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderArticle" ADD CONSTRAINT "ReaderArticle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
