export function evenlyDistribute<
  T extends { [P in K]: number },
  K extends keyof T,
>(input: T[], key: K): T[] {
  const n = input.length;
  if (n < 3) {
    return input;
  }
  const copy = input.map((item) => ({ ...item }));
  copy.sort((a, b) => a[key] - b[key]);
  const values = copy.map((item) => item[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const step = range / (n - 1);
  for (let i = 0; i < n; i++) {
    copy[i][key] = Math.round(min + i * step) as T[K];
  }
  return copy;
}
