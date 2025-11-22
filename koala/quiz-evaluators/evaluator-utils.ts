const MIN_LEN = 4;
const POINT_INCR = 10;

function calculateCutoff(length: number): number {
  return Math.ceil(Math.max(length - MIN_LEN, 0) / POINT_INCR);
}

export function compare(
  l: string,
  r: string,
  cutoffOverride = 0,
): boolean {
  const sl = strip(l);
  const sr = strip(r);
  let cutoff =
    cutoffOverride || calculateCutoff(Math.max(sl.length, sr.length));
  const containsNumber = /\d/.test(l + r);
  if (containsNumber) {
    cutoff = cutoff * 2;
  }

  if (cutoff === 0) {
    return sl === sr;
  }

  const score = levenshtein(sl, sr);

  return score <= cutoff;
}

function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) {
    return bn;
  }
  if (bn === 0) {
    return an;
  }
  const matrix = new Array<number[]>(bn + 1);
  for (let i = 0; i <= bn; ++i) {
    const row = (matrix[i] = new Array<number>(an + 1));
    row[0] = i;
  }
  const firstRow = matrix[0];
  for (let j = 1; j <= an; ++j) {
    firstRow[j] = j;
  }
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] =
          Math.min(
            matrix[i - 1][j - 1],
            matrix[i][j - 1],
            matrix[i - 1][j],
          ) + 1;
      }
    }
  }
  return matrix[bn][an];
}

export const stripFinalPunctuation = (str: string) => {
  return str.replace(/[.,!?]$/, "");
};

function strip(input: string): string {
  return input.replace(/[\p{P}\s\p{N}]/gu, "").toLocaleLowerCase();
}

export const removeParens = (input: string): string => {
  return input
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};
