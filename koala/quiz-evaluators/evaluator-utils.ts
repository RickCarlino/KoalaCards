export function strip(input: string): string {
  // This regex matches any punctuation, space, or number
  // \p{P} matches any kind of punctuation character
  // \s matches any whitespace character
  // \p{N} matches any kind of numeric character in any script
  return input.replace(/[\p{P}\s\p{N}]/gu, "").toLocaleLowerCase();
}

export const removeParens = (input: string): string => {
  // Replace parents and double whitespace
  return input
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};
