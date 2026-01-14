ALTER TABLE "WritingSubmission" DROP CONSTRAINT "WritingSubmission_deckId_fkey";
ALTER TABLE "WritingSubmission" ALTER COLUMN "deckId" DROP NOT NULL;
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
