/*
  Warnings:

  - You are about to drop the `OptimizerLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "imageBlobId" TEXT;

-- AlterTable
ALTER TABLE "Quiz" ALTER COLUMN "stability" SET DEFAULT 0,
ALTER COLUMN "difficulty" SET DEFAULT 0,
ALTER COLUMN "firstReview" SET DEFAULT 0,
ALTER COLUMN "lastReview" SET DEFAULT 0,
ALTER COLUMN "nextReview" SET DEFAULT 0;

-- DropTable
DROP TABLE "OptimizerLog";

-- CreateTable
CREATE TABLE "RevLog" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "lapses" DOUBLE PRECISION NOT NULL,
    "repetitions" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "firstReview" DOUBLE PRECISION NOT NULL,
    "lastReview" DOUBLE PRECISION NOT NULL,
    "gradedAt" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RevLog" ADD CONSTRAINT "RevLog_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
