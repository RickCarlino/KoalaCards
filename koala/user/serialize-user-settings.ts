import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { SerializedUserSettings } from "@/koala/user/types";

export function serializeUserSettings(
  settings: Awaited<ReturnType<typeof getUserSettingsFromEmail>>,
): SerializedUserSettings {
  return {
    id: settings.id,
    playbackSpeed: settings.playbackSpeed,
    cardsPerDayMax: settings.cardsPerDayMax,
    playbackPercentage: settings.playbackPercentage,
    dailyWritingGoal: settings.dailyWritingGoal ?? null,
    writingFirst: settings.writingFirst ?? null,
    performCorrectiveReviews: settings.performCorrectiveReviews ?? null,
    updatedAt: settings.updatedAt.toISOString(),
    user: {
      name: settings.user?.name ?? null,
      email: settings.user?.email ?? null,
      image: settings.user?.image ?? null,
      createdAt: settings.user?.createdAt?.toISOString() ?? null,
    },
  };
}
