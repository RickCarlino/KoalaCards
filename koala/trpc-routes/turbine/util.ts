export function clean(input: string[]) {
  return input
    .map((item) => item.trim())
    .filter((x) => x.length > 1)
    .sort();
}
