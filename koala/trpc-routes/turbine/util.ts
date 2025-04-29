export function clean(input: string) {
  return (input || "")
    .split(/\r?\n|,+/)
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .sort();
}
