import { z } from "zod";

export type ReaderJsonValue =
  | string
  | number
  | boolean
  | null
  | ReaderJsonValue[]
  | { [key: string]: ReaderJsonValue };

export const readerJsonValueSchema: z.ZodType<ReaderJsonValue> = z.lazy(
  () =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(readerJsonValueSchema),
      z.record(z.string(), readerJsonValueSchema),
    ]),
);

export const readerBookLocatorSchema = z
  .object({
    href: z.string().trim().min(1),
    title: z.string().trim().max(500).optional(),
    chapterTitle: z.string().trim().max(500).optional(),
    progression: z.number().min(0).max(1).optional(),
    totalProgression: z.number().min(0).max(1).optional(),
    sectionIndex: z.number().int().min(0).optional(),
  })
  .passthrough();

export type ReaderBookLocator = z.infer<typeof readerBookLocatorSchema>;

export function clampReaderProgression(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function locatorProgression(
  locator: ReaderBookLocator | null | undefined,
): number {
  if (!locator) {
    return 0;
  }

  if (typeof locator.totalProgression === "number") {
    return clampReaderProgression(locator.totalProgression);
  }

  if (typeof locator.progression === "number") {
    return clampReaderProgression(locator.progression);
  }

  return 0;
}

export function chooseFurthestReaderBookLocator(options: {
  existing: ReaderBookLocator | null;
  candidate: ReaderBookLocator;
}): ReaderBookLocator {
  const existingProgress = locatorProgression(options.existing);
  const candidateProgress = locatorProgression(options.candidate);

  if (candidateProgress >= existingProgress) {
    return options.candidate;
  }

  return options.existing ?? options.candidate;
}

export function normalizeReaderBookProgression(value: number): number {
  return Number(clampReaderProgression(value).toFixed(6));
}
