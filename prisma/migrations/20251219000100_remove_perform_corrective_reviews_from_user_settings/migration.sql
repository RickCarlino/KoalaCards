-- Remove the performCorrectiveReviews flag from UserSettings.
ALTER TABLE "UserSettings"
  DROP COLUMN IF EXISTS "performCorrectiveReviews";
