export type ReaderOwnershipDecision =
  | { status: "owned"; id: number }
  | { status: "missing" }
  | { status: "forbidden" };

export function resolveReaderOwnership(
  record: { id: number; userId: string } | null,
  userId: string,
): ReaderOwnershipDecision {
  if (!record) {
    return { status: "missing" };
  }
  if (record.userId !== userId) {
    return { status: "forbidden" };
  }
  return { status: "owned", id: record.id };
}
