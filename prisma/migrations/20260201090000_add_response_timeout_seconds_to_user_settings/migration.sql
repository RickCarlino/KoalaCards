-- Add responseTimeoutSeconds to UserSettings.
ALTER TABLE "UserSettings"
ADD COLUMN "responseTimeoutSeconds" INTEGER NOT NULL DEFAULT 0;
