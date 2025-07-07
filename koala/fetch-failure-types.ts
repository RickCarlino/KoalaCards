export type GetRepairInputParams = {
  userId: string;
  deckId: number;
  take: number;
};

export type GetRepairOutputParams = {
  cardId: number;
  definition: string;
  term: string;
  langCode: string;
  imageURL: string | undefined;
}[];
