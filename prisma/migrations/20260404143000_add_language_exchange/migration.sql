-- AlterTable
ALTER TABLE "User"
ADD COLUMN "languageExchangePresenceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "languageExchangeAvailable" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "LanguageExchangeStatus" AS ENUM (
  'WAITING',
  'MATCHED',
  'ENDED',
  'CANCELLED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "LanguageExchangeRequest" (
  "id" SERIAL NOT NULL,
  "guestToken" VARCHAR(64) NOT NULL,
  "status" "LanguageExchangeStatus" NOT NULL DEFAULT 'WAITING',
  "guestOfferSdp" JSONB,
  "learnerAnswerSdp" JSONB,
  "claimedByUserId" TEXT,
  "guestHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "learnerHeartbeatAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LanguageExchangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LanguageExchangeRequest_guestToken_key"
ON "LanguageExchangeRequest"("guestToken");

-- CreateIndex
CREATE INDEX "LanguageExchangeRequest_status_expiresAt_createdAt_idx"
ON "LanguageExchangeRequest"("status", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "LanguageExchangeRequest_claimedByUserId_status_idx"
ON "LanguageExchangeRequest"("claimedByUserId", "status");

-- AddForeignKey
ALTER TABLE "LanguageExchangeRequest"
ADD CONSTRAINT "LanguageExchangeRequest_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
