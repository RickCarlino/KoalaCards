-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "listeningPercentage" REAL NOT NULL DEFAULT 0.5,
    "playbackSpeed" REAL NOT NULL DEFAULT 1,
    "cardsPerDayMax" INTEGER NOT NULL DEFAULT 21,
    "playbackPercentage" REAL NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("createdAt", "id", "playbackPercentage", "updatedAt", "userId") SELECT "createdAt", "id", "playbackPercentage", "updatedAt", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
