export function shouldRedirectFromReviewPage(options: {
  hasDue: boolean;
  canStartNew: boolean;
}): boolean {
  return !options.hasDue && !options.canStartNew;
}

export function resolveWritingPracticeRedirect(options: {
  writingFirst: boolean;
  progress: number;
  goal: number;
  deckId: number;
  buildReviewPath: (deckId: number) => string;
  buildWritingPracticeUrl: (returnTo: string) => string;
}): string | null {
  if (!options.writingFirst || options.progress >= options.goal) {
    return null;
  }

  return options.buildWritingPracticeUrl(
    options.buildReviewPath(options.deckId),
  );
}
