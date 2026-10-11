export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;

  if (minutes > 0) {
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }
  return `${clamped}s`;
}
