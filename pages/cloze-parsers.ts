export function isCloze(text: string): boolean {
  return /\{\{c\d+::.*?\}\}/.test(text);
}

export function renderClozeDeletion(clozeId: number, text: string): string {
  // This regular expression matches all Cloze notations, capturing the ID and the text
  const regex = /\{\{c(\d+)::(.*?)\}\}/g;

  // Replace each Cloze notation in the string
  return text.replace(regex, (_, id, value) => {
    // Convert the captured ID to a number and compare with clozeId
    if (parseInt(id) === clozeId) {
      // Replace non-whitespace characters with underscores, preserve whitespace and punctuation
      return value.replace(/[\p{L}\p{N}]/gu, "-"); // Use Unicode property escapes
    } else {
      return value;
    }
  });
}

export function renderSolution(text: string): string {
  // Regular expression to find all Cloze notations and capture the hidden text
  const regex = /\{\{c\d+::(.*?)\}\}/g;

  // Replace each Cloze notation in the string with the hidden text only
  return text.replace(regex, (_, value) => value);
}

export function getClozeIDs(text: string): number[] {
  const regex = /\{\{c(\d+)::/g;
  let match: RegExpExecArray | null;
  const ids = new Set<number>();

  while ((match = regex.exec(text)) !== null) {
    ids.add(parseInt(match[1])); // Convert the captured ID to a number and add to the set
  }

  return Array.from(ids); // Convert the set to an array to return
}
