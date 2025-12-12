export type GenderCode = "M" | "F" | "N";

export function normalizeGender(value?: string | null): GenderCode {
  if (value === "M" || value === "F" || value === "N") {
    return value;
  }
  return "N";
}
