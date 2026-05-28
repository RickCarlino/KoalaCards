CREATE TABLE "DeckFsrsConfig" (
    "id" SERIAL NOT NULL,
    "deckId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedRetention" DOUBLE PRECISION NOT NULL,
    "parametersJson" JSONB NOT NULL,
    "parametersSource" TEXT NOT NULL,
    "tsFsrsVersion" TEXT NOT NULL,
    "schedulerFlagsJson" JSONB NOT NULL,
    "lastOptimizedAt" TIMESTAMP(3),
    "lastOptimizedLogId" BIGINT,
    "logsSinceOptimize" INTEGER NOT NULL DEFAULT 0,
    "eligibleLogCount" INTEGER NOT NULL DEFAULT 0,
    "optimizerStatus" TEXT,
    "optimizerError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckFsrsConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardReviewLog" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "deckFsrsConfigId" INTEGER NOT NULL,
    "cardId" INTEGER NOT NULL,
    "reviewAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER NOT NULL,
    "completeness" TEXT NOT NULL,
    "rawLogJson" JSONB NOT NULL,
    "cardBeforeJson" JSONB,
    "cardAfterJson" JSONB,
    "dueAt" TIMESTAMP(3),
    "scheduledDays" DOUBLE PRECISION,
    "elapsedDays" DOUBLE PRECISION,
    "stabilityBefore" DOUBLE PRECISION,
    "stabilityAfter" DOUBLE PRECISION,
    "difficultyBefore" DOUBLE PRECISION,
    "difficultyAfter" DOUBLE PRECISION,
    "tsFsrsVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReviewLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Card" ADD COLUMN "reviewLogCoverage" TEXT;
ALTER TABLE "Card" ADD COLUMN "reviewLogStartedAt" TIMESTAMP(3);

INSERT INTO "DeckFsrsConfig" (
    "deckId",
    "userId",
    "requestedRetention",
    "parametersJson",
    "parametersSource",
    "tsFsrsVersion",
    "schedulerFlagsJson",
    "logsSinceOptimize",
    "eligibleLogCount",
    "optimizerStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    "Deck"."id",
    "Deck"."userId",
    COALESCE("UserSettings"."requestedRetention", 0.73),
    jsonb_build_object(
        'request_retention', COALESCE("UserSettings"."requestedRetention", 0.73),
        'maximum_interval', 36500,
        'w', jsonb_build_array(
            0.212,
            1.2931,
            2.3065,
            8.2956,
            6.4133,
            0.8334,
            3.0194,
            0.001,
            1.8722,
            0.1666,
            0.796,
            1.4835,
            0.0614,
            0.2629,
            1.6483,
            0.6014,
            1.8729,
            0.5425,
            0.0912,
            0.0658,
            0.1542
        ),
        'enable_fuzz', true,
        'enable_short_term', false,
        'learning_steps', jsonb_build_array('1m', '10m'),
        'relearning_steps', jsonb_build_array('10m')
    ),
    'default',
    '5.4.0',
    jsonb_build_object('enable_fuzz', true, 'enable_short_term', false),
    0,
    0,
    'idle',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Deck"
LEFT JOIN "UserSettings" ON "UserSettings"."userId" = "Deck"."userId";

CREATE UNIQUE INDEX "DeckFsrsConfig_deckId_key" ON "DeckFsrsConfig"("deckId");
CREATE INDEX "DeckFsrsConfig_userId_idx" ON "DeckFsrsConfig"("userId");
CREATE INDEX "CardReviewLog_deckId_reviewAt_idx" ON "CardReviewLog"("deckId", "reviewAt");
CREATE INDEX "CardReviewLog_deckFsrsConfigId_reviewAt_idx" ON "CardReviewLog"("deckFsrsConfigId", "reviewAt");
CREATE INDEX "CardReviewLog_cardId_reviewAt_idx" ON "CardReviewLog"("cardId", "reviewAt");
CREATE INDEX "CardReviewLog_userId_deckId_reviewAt_idx" ON "CardReviewLog"("userId", "deckId", "reviewAt");

ALTER TABLE "DeckFsrsConfig" ADD CONSTRAINT "DeckFsrsConfig_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckFsrsConfig" ADD CONSTRAINT "DeckFsrsConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReviewLog" ADD CONSTRAINT "CardReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReviewLog" ADD CONSTRAINT "CardReviewLog_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReviewLog" ADD CONSTRAINT "CardReviewLog_deckFsrsConfigId_fkey" FOREIGN KEY ("deckFsrsConfigId") REFERENCES "DeckFsrsConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReviewLog" ADD CONSTRAINT "CardReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
