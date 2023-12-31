export function timeUntil(
  timestamp: number,
  now = new Date().getTime(),
): string {
  let difference = timestamp - now;

  if (difference < 0) {
    return "already past";
  }

  const secondsInYear = 31536000;
  const secondsInDay = 86400;
  const secondsInHour = 3600;
  const secondsInMinute = 60;

  // Convert milliseconds to seconds
  difference = Math.floor(difference / 1000);

  const years = Math.floor(difference / secondsInYear);
  difference -= years * secondsInYear;

  const days = Math.floor(difference / secondsInDay);
  difference -= days * secondsInDay;

  const hours = Math.floor(difference / secondsInHour);
  difference -= hours * secondsInHour;

  const minutes = Math.floor(difference / secondsInMinute);
  difference -= minutes * secondsInMinute;

  const seconds = difference;

  let result = "";
  if (years > 0) result += `${years} years `;
  if (days > 0) result += `${days} days `;
  if (hours > 0) result += `${hours} hours `;
  if (minutes > 0) result += `${minutes} minutes `;
  if (seconds > 0) result += `${seconds} seconds `;

  return result.trim();
}

// Define keys for Spaced Repetition System (SRS) data
type SRSKeys =
  | "repetitions"
  | "interval"
  | "ease"
  | "lapses"
  | "nextReviewAt"
  | "lapses";

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
export function gradePerformance(
  card: Partial<SRSData>,
  grade: number,
  now = Date.now(),
): SRSData {
  let { repetitions, interval, ease, lapses } = {
    ...DEFAULT_CARD,
    ...card,
  };

  // If grade is 3 or higher, update repetitions, interval, and ease
  if (grade >= 3) {
    interval = Math.ceil(interval * ease); // Don't swap variable order, it matters!
    repetitions += 1;
    ease = calculateEase(ease, grade);
  } else {
    // If grade is less than 3, reset repetitions and interval, update ease, and increase lapses
    interval = 1;
    repetitions = 0;
    ease = calculateEase(ease, grade);
    lapses += 1;
  }
  const nextReviewAt = now + interval * 24 * 60 * 60 * 1000;
  console.log(`=== Card will review again in ${timeUntil(nextReviewAt, now)}`);
  return {
    ...card,
    repetitions,
    interval,
    ease,
    lapses,
    nextReviewAt,
  };
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
