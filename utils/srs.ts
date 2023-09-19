import { pick } from "radash";

/** Convert seconds to days */
const minutes = (m: number) => m / 60 / 24;
const hours = (h: number) => h / 24;

// My flavor of SM-2 departs from the original slightly.
// I review more often in the beginning.
const EARLY_REVIEW_INTERVAL_MAPPING: Record<number, number> = {
  0: minutes(0.5),
  1: minutes(5),
  2: hours(1),
  3: hours(5),
  4: hours(24),
};

// Define keys for Spaced Repetition System (SRS) data
type SRSKeys = "repetitions" | "interval" | "ease" | "lapses" | "nextReviewAt";

// Define the SRS data structure using the keys
type SRSData = Record<SRSKeys, number>;

// Constants for ease calculation
const MIN_EASE = 1.3;
const EASE_DECAY = 0.8;
const GRADE_REWARD = 0.28;
const NONLINEAR_ADJUSTMENT = 0.02;

// Function to calculate the ease value based on the current ease and grade
function calculateEase(ease: number, grade: number): number {
  // Start with the current ease value and subtract the ease decay constant
  let newEase = ease - EASE_DECAY;

  // Add the reward for the current grade, scaled by the grade reward constant
  let gradeReward = GRADE_REWARD * grade;
  newEase += gradeReward;

  // Subtract a nonlinear adjustment, scaled by the square of the grade
  let nonlinearAdjustment = NONLINEAR_ADJUSTMENT * grade * grade;
  newEase -= nonlinearAdjustment;

  // Ensure the new ease value is at least the minimum allowed ease
  if (newEase < MIN_EASE) {
    newEase = MIN_EASE;
  }

  return newEase;
}

// Function to update a card's SRS data based on the user's performance grade
export function gradePerformance(card: SRSData, grade: number): SRSData {
  let { repetitions, interval, ease, lapses } = card;

  // If grade is 3 or higher, update repetitions, interval, and ease
  if (grade >= 3) {
    repetitions += 1;
    interval =
      EARLY_REVIEW_INTERVAL_MAPPING[repetitions] || Math.ceil(interval * ease);
    ease = calculateEase(ease, grade);
  } else {
    // If grade is less than 3, reset repetitions and interval, update ease, and increase lapses
    repetitions = 0;
    interval = 1;
    ease = calculateEase(ease, grade);
    lapses += 1;
  }
  const nextReviewAt = Date.now() + interval * 24 * 60 * 60 * 1000;
  const keys: (keyof SRSData)[] = [
    "repetitions",
    "interval",
    "ease",
    "lapses",
    "nextReviewAt",
  ];
  // Return the updated card data
  return pick(
    {
      ...card,
      repetitions,
      interval,
      ease,
      lapses,
      nextReviewAt,
    },
    keys,
  );
}

const DEFAULT_CARD: SRSData = {
  repetitions: 0,
  interval: 1,
  ease: 2.5,
  lapses: 0,
  nextReviewAt: 0,
};

// Function to create a new card with default SRS values
export function createCard(i: Partial<SRSData> = {}): SRSData {
  return {
    ...DEFAULT_CARD,
    ...i,
  };
}
