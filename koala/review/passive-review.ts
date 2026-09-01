export const PASSIVE_REVIEW_RATIO = 0.3;
export const PASSIVE_REVIEW_SIMILARITY = 0.6;

export function getPassiveReviewEligibility(
  userId: string,
  deckId: number,
) {
  return {
    userId,
    deckId,
    paused: false,
    repetitions: { gte: 2 },
  } as const;
}

export function getPassiveReviewCount(normalCardCount: number): number {
  return Math.floor(Math.max(normalCardCount, 0) * PASSIVE_REVIEW_RATIO);
}

export function interleaveEvenly<T>(
  normalItems: readonly T[],
  passiveItems: readonly T[],
): T[] {
  if (normalItems.length === 0) {
    return [...passiveItems];
  }
  if (passiveItems.length === 0) {
    return [...normalItems];
  }

  const insertionPoints = passiveItems.map((_, index) =>
    Math.round(
      ((index + 1) * normalItems.length) / (passiveItems.length + 1),
    ),
  );
  const result: T[] = [];
  let passiveIndex = 0;

  for (
    let normalIndex = 0;
    normalIndex <= normalItems.length;
    normalIndex += 1
  ) {
    while (insertionPoints[passiveIndex] === normalIndex) {
      result.push(passiveItems[passiveIndex]);
      passiveIndex += 1;
    }
    if (normalIndex < normalItems.length) {
      result.push(normalItems[normalIndex]);
    }
  }

  return result;
}
