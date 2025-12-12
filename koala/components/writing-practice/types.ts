export type WritingPracticeFeedback = {
  fullCorrection: string;
  fullText: string;
  feedback: string[];
};

export type WordDefinition = {
  word: string;
  lemma: string | null;
  definition: string;
};

export type SelectedWords = Record<string, boolean>;

export type DailyWritingProgress = {
  progress: number;
  goal: number | null;
};
