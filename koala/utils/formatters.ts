const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function formatYesNo(value: boolean): "Yes" | "No" {
  if (value) {
    return "Yes";
  }
  return "No";
}

export function formatIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatIsoDateTimeShort(
  iso: string | null,
  emptyLabel: string = "—",
): string {
  if (!iso) {
    return emptyLabel;
  }
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
