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
    "The sentence is too long. Break it into smaller sub-sentences.",
  [RemixTypes.VOCAB]:
    "Create one sentence in the target language for each vocabulary word in the input sentence, starting with the most advanced words first. Don't add notes or parenthesis.",
};

export const RemixTypeDescriptions: Record<RemixTypes, string> = {
  [RemixTypes.VOCAB]: "Similar Vocabulary Words",
  [RemixTypes.GRAMMAR]: "Similar Sentence Structure",
  [RemixTypes.THEME]: "Similar Themes",
  [RemixTypes.CONJUGATION]: "Different Conjugation",
  [RemixTypes.TOO_LONG]: "Break into Smaller Sentences",
};
