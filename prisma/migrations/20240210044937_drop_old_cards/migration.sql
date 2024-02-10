/*
  Warnings:

  - You are about to drop the `Card` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transcript` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Card";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Transcript";
PRAGMA foreign_keys=on;
