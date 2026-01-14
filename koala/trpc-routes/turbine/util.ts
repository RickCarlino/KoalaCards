const READLANG_PATTERN = /\[\[([^\]]+)\]\]/g;

const normalize = (value: string) => value.trim();

const isNonEmpty = (value: string) => value.length > 0;

const hasWhitespace = (value: string) => /\s/.test(value);

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values)).sort();

type ReadlangCleanupResult = {
  terms: string[];
  hasMarkup: boolean;
};

const readlangCleanup = (input?: string): ReadlangCleanupResult => {
  const raw = input ?? "";
  const extracted = Array.from(raw.matchAll(READLANG_PATTERN), (match) =>
    normalize(match[1] ?? ""),
  ).filter(isNonEmpty);
  const terms = uniqueSorted(
    extracted.filter((value) => !hasWhitespace(value)),
  );
  return { terms, hasMarkup: extracted.length > 0 };
};

export function clean(input?: string) {
  const readlang = readlangCleanup(input);
  if (readlang.hasMarkup) {
    return readlang.terms;
  }

  const raw = input ?? "";
  const parsed = raw
    .split(/\r?\n|,+/)
    .map(normalize)
    .filter(isNonEmpty);
  return uniqueSorted(parsed);
}
