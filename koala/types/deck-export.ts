import { z } from "zod";

const deckExportCardBase = z.object({
  term: z.string(),
  definition: z.string(),
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

const deckExportLegacyCardBase = deckExportCardBase.extend({
  gender: z.enum(["M", "F", "N"]),
});

const deckExportCardSchemaV1 = deckExportLegacyCardBase.extend({
  flagged: z.boolean(),
});

const deckExportCardSchemaV2 = deckExportLegacyCardBase.extend({
  paused: z.boolean(),
});

const deckExportCardSchemaV3 = deckExportCardBase.extend({
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

const deckExportSchemaV3 = z.object({
  version: z.literal(3),
  exportedAt: z.string(),
  cards: z.array(deckExportCardSchemaV3),
});

export const deckExportSchema = z.discriminatedUnion("version", [
  deckExportSchemaV1,
  deckExportSchemaV2,
  deckExportSchemaV3,
]);

export type DeckExport = z.infer<typeof deckExportSchema>;
export type DeckExportCard =
  | z.infer<typeof deckExportCardSchemaV1>
  | z.infer<typeof deckExportCardSchemaV2>
  | z.infer<typeof deckExportCardSchemaV3>;
