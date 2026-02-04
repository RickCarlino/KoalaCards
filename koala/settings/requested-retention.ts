export const REQUESTED_RETENTION_MIN = 0.65;
export const REQUESTED_RETENTION_MAX = 0.95;
export const REQUESTED_RETENTION_DEFAULT = 0.73;

export function clampRequestedRetention(value: number): number {
  return Math.min(
    Math.max(value, REQUESTED_RETENTION_MIN),
    REQUESTED_RETENTION_MAX,
  );
}

export function resolveRequestedRetention(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return REQUESTED_RETENTION_DEFAULT;
  }
  return clampRequestedRetention(value);
}
