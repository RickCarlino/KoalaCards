import { z } from "zod";

export const deckExportCardSchema = z.object({
  term: z.string(),
  definition: z.string(),
  gender: z.enum(["M", "F", "N"]),
  flagged: z.boolean(),
  imageBlobId: z.string().nullable(),
  stability: z.number(),
  difficulty: z.number(),
  firstReview: z.number(),
  lastReview: z.number(),
  nextReview: z.number(),
  lapses: z.number(),
  repetitions: z.number(),
  lastFailure: z.number(),
  createdAt: z.string(),
});

export const deckExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  cards: z.array(deckExportCardSchema),
});

export type DeckExport = z.infer<typeof deckExportSchema>;
export type DeckExportCard = z.infer<typeof deckExportCardSchema>;
