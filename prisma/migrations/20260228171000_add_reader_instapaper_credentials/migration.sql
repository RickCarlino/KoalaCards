-- CreateTable
CREATE TABLE "ReaderInstapaperCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "instapaperUsername" VARCHAR(200) NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedAccessSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderInstapaperCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaderInstapaperCredential_userId_key" ON "ReaderInstapaperCredential"("userId");

-- CreateIndex
CREATE INDEX "ReaderInstapaperCredential_userId_idx" ON "ReaderInstapaperCredential"("userId");

-- AddForeignKey
ALTER TABLE "ReaderInstapaperCredential" ADD CONSTRAINT "ReaderInstapaperCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
