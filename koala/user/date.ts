const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, deltaDays: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function addMonths(date: Date, deltaMonths: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + deltaMonths);
  return next;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function dateKeysInclusive(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let day = startOfDay(start);
  const endDay = startOfDay(end);

  while (day <= endDay) {
    keys.push(formatDateKey(day));
    day = addDays(day, 1);
  }

  return keys;
}

export function subtractDaysMs(date: Date, days: number): number {
  return date.getTime() - days * ONE_DAY_MS;
}

export function addDaysMs(date: Date, days: number): number {
  return date.getTime() + days * ONE_DAY_MS;
}
