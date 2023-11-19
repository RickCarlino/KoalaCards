// levenshtein distance calculator
const distance = (str1: string, str2: string) => {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[str2.length][str1.length];
};

const cleanString = (str: string) => {
  // This regex matches any whitespace characters or punctuation
  return str.replace(/[\s\.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
};

export const exactMatch = (str: string, query: string) => {
  const d = distance(cleanString(str), cleanString(query));
  const match = d < 2;
  console.log(`${d ? "Nearly " : ""}Exact match: ${str} / ${query}`);
  return match;
};
