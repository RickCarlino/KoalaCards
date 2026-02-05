import { z } from "zod";

const deckExportCardBase = z.object({
  term: z.string(),
  definition: z.string(),
  gender: z.enum(["M", "F", "N"]),
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

const deckExportCardSchemaV1 = deckExportCardBase.extend({
  flagged: z.boolean(),
});

const deckExportCardSchemaV2 = deckExportCardBase.extend({
  paused: z.boolean(),
});

const deckExportSchemaV1 = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  cards: z.array(deckExportCardSchemaV1),
});

const deckExportSchemaV2 = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  cards: z.array(deckExportCardSchemaV2),
});

export const deckExportSchema = z.discriminatedUnion("version", [
  deckExportSchemaV1,
  deckExportSchemaV2,
]);

export type DeckExport = z.infer<typeof deckExportSchema>;
export type DeckExportCard =
  | z.infer<typeof deckExportCardSchemaV1>
  | z.infer<typeof deckExportCardSchemaV2>;
