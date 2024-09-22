-- CreateTable
CREATE TABLE "SpeakingCorrection" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrect" BOOLEAN NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "correction" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SpeakingCorrection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SpeakingCorrection" ADD CONSTRAINT "SpeakingCorrection_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
