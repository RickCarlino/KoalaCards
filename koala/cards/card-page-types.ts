export type CardView = {
  id: number;
  term: string;
  definition: string;
  flagged: boolean;
  langCode: string;
  gender: string;
  imageURL: string | null;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
  deckName: string | null;
};

export type CardPageProps = {
  card: CardView;
};
