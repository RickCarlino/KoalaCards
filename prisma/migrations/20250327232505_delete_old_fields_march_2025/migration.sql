/*
  Warnings:

  - You are about to drop the column `mirrorRepetitionCount` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the `SpeakingCorrection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SpeakingCorrection" DROP CONSTRAINT "SpeakingCorrection_cardId_fkey";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "mirrorRepetitionCount";

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "parentDeckId" INTEGER,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "SpeakingCorrection";
