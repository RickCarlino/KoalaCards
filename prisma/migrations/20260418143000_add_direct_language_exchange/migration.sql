CREATE TYPE "LanguageExchangeCallStatus" AS ENUM (
  'RINGING',
  'ACTIVE',
  'ENDED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TABLE "LanguageExchangeLink" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LanguageExchangeLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LanguageExchangePresence" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "leaseId" VARCHAR(64) NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LanguageExchangePresence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LanguageExchangeCall" (
  "id" SERIAL NOT NULL,
  "linkId" INTEGER NOT NULL,
  "learnerId" TEXT NOT NULL,
  "guestToken" VARCHAR(64) NOT NULL,
  "status" "LanguageExchangeCallStatus" NOT NULL DEFAULT 'RINGING',
  "offerSdp" JSONB,
  "answerSdp" JSONB,
  "guestHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "learnerHeartbeatAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LanguageExchangeCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LanguageExchangeLink_userId_key"
ON "LanguageExchangeLink"("userId");

CREATE UNIQUE INDEX "LanguageExchangeLink_slug_key"
ON "LanguageExchangeLink"("slug");

CREATE UNIQUE INDEX "LanguageExchangePresence_userId_key"
ON "LanguageExchangePresence"("userId");

CREATE INDEX "LanguageExchangePresence_expiresAt_idx"
ON "LanguageExchangePresence"("expiresAt");

CREATE UNIQUE INDEX "LanguageExchangeCall_guestToken_key"
ON "LanguageExchangeCall"("guestToken");

CREATE INDEX "LanguageExchangeCall_learnerId_status_createdAt_idx"
ON "LanguageExchangeCall"("learnerId", "status", "createdAt");

CREATE INDEX "LanguageExchangeCall_linkId_status_createdAt_idx"
ON "LanguageExchangeCall"("linkId", "status", "createdAt");

CREATE INDEX "LanguageExchangeCall_status_expiresAt_createdAt_idx"
ON "LanguageExchangeCall"("status", "expiresAt", "createdAt");

CREATE UNIQUE INDEX "LanguageExchangeCall_active_learner_key"
ON "LanguageExchangeCall"("learnerId")
WHERE "status" IN ('RINGING', 'ACTIVE');

ALTER TABLE "LanguageExchangeLink"
ADD CONSTRAINT "LanguageExchangeLink_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LanguageExchangePresence"
ADD CONSTRAINT "LanguageExchangePresence_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LanguageExchangeCall"
ADD CONSTRAINT "LanguageExchangeCall_linkId_fkey"
FOREIGN KEY ("linkId") REFERENCES "LanguageExchangeLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LanguageExchangeCall"
ADD CONSTRAINT "LanguageExchangeCall_learnerId_fkey"
FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
