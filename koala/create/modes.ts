export type CreateMode = "vibe" | "wordlist" | "csv";

function isCreateMode(value: unknown): value is CreateMode {
  return value === "vibe" || value === "wordlist" || value === "csv";
}

export function parseCreateMode(value: unknown): CreateMode | undefined {
  return isCreateMode(value) ? value : undefined;
}
