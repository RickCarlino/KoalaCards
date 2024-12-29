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
    "Create new sentences that contain words from the original sentence.",
};

export const RemixTypeDescriptions: Record<RemixTypes, string> = {
  [RemixTypes.VOCAB]: "Similar Vocabulary",
  [RemixTypes.GRAMMAR]: "Similar Grammar",
  [RemixTypes.THEME]: "Similar Themes",
  [RemixTypes.CONJUGATION]: "Different Conjugation",
  [RemixTypes.TOO_LONG]: "Shorter Length",
};

// type HyperParams = {
//   temperature: number;
//   frequency_penalty: number,
//   presence_penalty: number;
// };
// export const hyperParams: Record<RemixTypes, HyperParams> = {
//   [RemixTypes.VOCAB]: {
//     temperature: 0.7,
//     frequency_penalty: 0,
//     presence_penalty: 0,
//   },
//   [RemixTypes.GRAMMAR]: {
//     temperature: 0.7,
//     frequency_penalty: 2,
//     presence_penalty: 0,
//   },
//   [RemixTypes.THEME]: {
//     temperature: 0.7,
//     frequency_penalty: 0,
//     presence_penalty: 0,
//   },
//   [RemixTypes.CONJUGATION]: {
//     temperature: 0.7,
//     frequency_penalty: 0,
//     presence_penalty: 0,
//   },
//   [RemixTypes.TOO_LONG]: {
//     temperature: 0.7,
//     frequency_penalty: 0,
//     presence_penalty: 0,
//   },
// };
