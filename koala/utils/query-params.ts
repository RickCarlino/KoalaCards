export function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export function firstQueryValueFrom(
  query: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = firstQueryValue(query[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function toBoolean(value: string | undefined): boolean {
  return value === "true";
}

export function toPositiveIntOrNull(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed > 0 ? parsed : null;
}

export function toPositiveIntOrDefault(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = toPositiveIntOrNull(value);
  return parsed ?? fallback;
}

export function toEnumOrDefault<const T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }
  for (const candidate of allowed) {
    if (candidate === value) {
      return candidate;
    }
  }
  return fallback;
}
