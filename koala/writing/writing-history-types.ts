export type WritingDeckView = {
  id: number;
  name: string;
  langCode: string;
};

export type WritingSubmissionView = {
  id: number;
  prompt: string;
  submission: string;
  correction: string;
  createdAt: string;
  deck: WritingDeckView;
};

export type WritingHistoryProps = {
  submissions: WritingSubmissionView[];
  totalPages: number;
  currentPage: number;
  decks: WritingDeckView[];
  q: string;
  deckId: number | null;
};
