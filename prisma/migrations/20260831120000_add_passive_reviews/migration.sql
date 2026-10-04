ALTER TABLE "Card"
ADD COLUMN "last_passive_review_at" TIMESTAMP(3);

CREATE INDEX "Card_userId_deckId_last_passive_review_at_idx"
ON "Card"("userId", "deckId", "last_passive_review_at");
