-- CreateTable
CREATE TABLE "ReaderBook" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fingerprint" VARCHAR(512) NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "language" VARCHAR(32) NOT NULL DEFAULT '',
    "opfIdentifier" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "fileLastModified" BIGINT NOT NULL,
    "coverPath" TEXT NOT NULL DEFAULT '',
    "targetFormat" VARCHAR(40) NOT NULL DEFAULT 'REFLOWABLE_EPUB',
    "navigationJson" JSONB NOT NULL,
    "spineJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderBookProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "lastLocatorJson" JSONB NOT NULL,
    "furthestLocatorJson" JSONB NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderBookProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderBookBookmark" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "locatorJson" JSONB NOT NULL,
    "epubCfi" TEXT,
    "chapterTitle" TEXT NOT NULL DEFAULT '',
    "progression" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderBookBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderBookAnnotation" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "locatorJson" JSONB NOT NULL,
    "epubCfi" TEXT,
    "chapterTitle" TEXT NOT NULL DEFAULT '',
    "progression" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quote" TEXT NOT NULL,
    "contextBefore" TEXT NOT NULL DEFAULT '',
    "contextAfter" TEXT NOT NULL DEFAULT '',
    "selectedTextHash" VARCHAR(64) NOT NULL,
    "selectedOccurrenceIndex" INTEGER NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "occurrencesJson" JSONB NOT NULL,
    "sectionTextHash" VARCHAR(64) NOT NULL,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ReaderHighlightStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "term" TEXT NOT NULL DEFAULT '',
    "definition" TEXT NOT NULL DEFAULT '',
    "generalMeaning" TEXT NOT NULL DEFAULT '',
    "meaningInContext" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "importedCardId" INTEGER,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderBookAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBook_publicId_key" ON "ReaderBook"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBook_userId_fingerprint_key" ON "ReaderBook"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "ReaderBook_userId_createdAt_idx" ON "ReaderBook"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderBook_publicId_idx" ON "ReaderBook"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBookProgress_bookId_key" ON "ReaderBookProgress"("bookId");

-- CreateIndex
CREATE INDEX "ReaderBookProgress_userId_lastOpenedAt_idx" ON "ReaderBookProgress"("userId", "lastOpenedAt");

-- CreateIndex
CREATE INDEX "ReaderBookBookmark_userId_bookId_createdAt_idx" ON "ReaderBookBookmark"("userId", "bookId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderBookBookmark_bookId_createdAt_idx" ON "ReaderBookBookmark"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderBookAnnotation_userId_bookId_createdAt_idx" ON "ReaderBookAnnotation"("userId", "bookId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderBookAnnotation_bookId_createdAt_idx" ON "ReaderBookAnnotation"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "ReaderBookAnnotation_importedCardId_idx" ON "ReaderBookAnnotation"("importedCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderBookAnnotation_cache_key" ON "ReaderBookAnnotation"("userId", "bookId", "selectedTextHash", "selectedOccurrenceIndex", "sectionTextHash", "promptVersion");

-- AddForeignKey
ALTER TABLE "ReaderBook" ADD CONSTRAINT "ReaderBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookProgress" ADD CONSTRAINT "ReaderBookProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookProgress" ADD CONSTRAINT "ReaderBookProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "ReaderBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookBookmark" ADD CONSTRAINT "ReaderBookBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookBookmark" ADD CONSTRAINT "ReaderBookBookmark_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "ReaderBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookAnnotation" ADD CONSTRAINT "ReaderBookAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookAnnotation" ADD CONSTRAINT "ReaderBookAnnotation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "ReaderBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderBookAnnotation" ADD CONSTRAINT "ReaderBookAnnotation_importedCardId_fkey" FOREIGN KEY ("importedCardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
