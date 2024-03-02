export const FOOTER = `
This question is being used to grade a student's work in a
language learning flashcard app. The student entered the
text via speech-to-text. They have no control over punctuation
or spacing, so you should not grade them on these details.
Also, don't nitpick the details if there are only small differences.
The goal is to find major problems with meaning or grammar.
`;

export function strip(input: string): string {
  // This regex matches any punctuation, space, or number
  // \p{P} matches any kind of punctuation character
  // \s matches any whitespace character
  // \p{N} matches any kind of numeric character in any script
  return input.replace(/[\p{P}\s\p{N}]/gu, "").toLocaleLowerCase();
}
