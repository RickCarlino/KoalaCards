export enum RemixTypes {
  GRAMMAR,
  VOCAB,
  CONJUGATION,
  TOO_LONG,
  THEME,
}

export const RemixTypePrompts: Record<RemixTypes, string> = {
  [RemixTypes.CONJUGATION]:
    "Generate the same sentence, but conjugate the verb in varied ways.",
  [RemixTypes.GRAMMAR]:
    "Generate sentences with the same grammatical structure, but different vocabulary.",
  [RemixTypes.THEME]:
    "Freely modify grammar and vocab, but keep the same theme.",
  [RemixTypes.TOO_LONG]:
    "The sentence is too long. Break it into smaller sentences with similar grammar and vocab.",
  [RemixTypes.VOCAB]:
    "Create new sentences that contain words from the original sentence.",
};

export const RemixTypeDescriptions: Record<RemixTypes, string> = {
  [RemixTypes.VOCAB]: "Similar Vocabulary",
  [RemixTypes.GRAMMAR]: "Similar Grammar",
  [RemixTypes.THEME]: "Similar Themes",
  [RemixTypes.CONJUGATION]: "Different Conjugation",
  [RemixTypes.TOO_LONG]: "Shorter Length",
};
