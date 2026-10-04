import type { ReaderPreferences } from "./contracts";

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  fontSize: 20,
  lineHeight: 1.75,
  readingWidth: 800,
};

export const READER_PREFERENCE_LIMITS = {
  fontSize: {
    min: 14,
    max: 26,
    step: 1,
  },
  lineHeight: {
    min: 1.35,
    max: 2.15,
    step: 0.05,
  },
  readingWidth: {
    min: 600,
    max: 1000,
    step: 20,
  },
} as const;

function finiteNumberOrDefault(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveReaderPreferences(
  input: Partial<ReaderPreferences> | null | undefined,
): ReaderPreferences {
  const fontSize = finiteNumberOrDefault(
    input?.fontSize,
    DEFAULT_READER_PREFERENCES.fontSize,
  );
  const lineHeight = finiteNumberOrDefault(
    input?.lineHeight,
    DEFAULT_READER_PREFERENCES.lineHeight,
  );
  const readingWidth = finiteNumberOrDefault(
    input?.readingWidth,
    DEFAULT_READER_PREFERENCES.readingWidth,
  );

  return {
    fontSize: Math.round(
      clamp(
        fontSize,
        READER_PREFERENCE_LIMITS.fontSize.min,
        READER_PREFERENCE_LIMITS.fontSize.max,
      ),
    ),
    lineHeight: clamp(
      lineHeight,
      READER_PREFERENCE_LIMITS.lineHeight.min,
      READER_PREFERENCE_LIMITS.lineHeight.max,
    ),
    readingWidth: Math.round(
      clamp(
        readingWidth,
        READER_PREFERENCE_LIMITS.readingWidth.min,
        READER_PREFERENCE_LIMITS.readingWidth.max,
      ),
    ),
  };
}
