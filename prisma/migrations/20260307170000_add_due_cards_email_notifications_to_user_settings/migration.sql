-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "dueCardsEmailNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dueCardsEmailNotificationSentAt" TIMESTAMP(3);
