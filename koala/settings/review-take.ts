export const REVIEW_TAKE_MIN = 1;
export const REVIEW_TAKE_MAX = 48;
export const REVIEW_TAKE_DEFAULT = 5;

export function clampReviewTake(value: number): number {
  return Math.min(Math.max(value, REVIEW_TAKE_MIN), REVIEW_TAKE_MAX);
}
