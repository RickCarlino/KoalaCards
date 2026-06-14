import type { EpubReadingPreferences } from "./types";

export const DEFAULT_EPUB_READING_PREFERENCES: EpubReadingPreferences = {
  fontSize: 20,
  lineHeight: 1.75,
  columnWidth: 800,
};

export const EPUB_READING_PREFERENCE_LIMITS = {
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
  columnWidth: {
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

export function resolveEpubReadingPreferences(
  input: Partial<EpubReadingPreferences> | null | undefined,
): EpubReadingPreferences {
  const fontSize = finiteNumberOrDefault(
    input?.fontSize,
    DEFAULT_EPUB_READING_PREFERENCES.fontSize,
  );
  const lineHeight = finiteNumberOrDefault(
    input?.lineHeight,
    DEFAULT_EPUB_READING_PREFERENCES.lineHeight,
  );
  const columnWidth = finiteNumberOrDefault(
    input?.columnWidth,
    DEFAULT_EPUB_READING_PREFERENCES.columnWidth,
  );

  return {
    fontSize: Math.round(
      clamp(
        fontSize,
        EPUB_READING_PREFERENCE_LIMITS.fontSize.min,
        EPUB_READING_PREFERENCE_LIMITS.fontSize.max,
      ),
    ),
    lineHeight: clamp(
      lineHeight,
      EPUB_READING_PREFERENCE_LIMITS.lineHeight.min,
      EPUB_READING_PREFERENCE_LIMITS.lineHeight.max,
    ),
    columnWidth: Math.round(
      clamp(
        columnWidth,
        EPUB_READING_PREFERENCE_LIMITS.columnWidth.min,
        EPUB_READING_PREFERENCE_LIMITS.columnWidth.max,
      ),
    ),
  };
}
