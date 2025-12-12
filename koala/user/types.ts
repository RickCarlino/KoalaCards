export type ChartDataPoint = { date: string; count: number };

export type QuickStat = { label: string; value: number | string };

export type SerializedUserSettings = {
  id: number;
  playbackSpeed: number;
  cardsPerDayMax: number;
  playbackPercentage: number;
  dailyWritingGoal: number | null;
  writingFirst: boolean | null;
  performCorrectiveReviews: boolean | null;
  updatedAt: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: string | null;
  };
};

export type EditableUserSettings = Omit<
  SerializedUserSettings,
  "dailyWritingGoal" | "writingFirst" | "performCorrectiveReviews"
> & {
  dailyWritingGoal: number;
  writingFirst: boolean;
  performCorrectiveReviews: boolean;
};

export function toEditableUserSettings(
  settings: SerializedUserSettings,
): EditableUserSettings {
  return {
    ...settings,
    dailyWritingGoal: settings.dailyWritingGoal ?? 300,
    writingFirst: settings.writingFirst ?? false,
    performCorrectiveReviews: settings.performCorrectiveReviews ?? true,
  };
}
