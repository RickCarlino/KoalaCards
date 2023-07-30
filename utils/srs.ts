type SRSKeys = "repetitions" | "interval" | "ease" | "lapses";
type SRSData = Record<SRSKeys, number>;

function createCard(): SRSData {
  return {
    repetitions: 0,
    interval: 1,
    ease: 2.5,
    lapses: 0,
  };
}

function gradePerformance(card: SRSData, grade: number): SRSData {
  let { repetitions, interval, ease, lapses } = card;

  if (grade >= 3) {
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.ceil(interval * ease);
    }

    ease = calculateEase(ease, grade);
  } else {
    repetitions = 0;
    interval = 1;
    ease = calculateEase(ease, grade);
    lapses += 1;
  }

  return {
    ...card,
    repetitions,
    interval,
    ease,
    lapses,
  };
}

const MIN_EASE = 1.3;
const EASE_DECAY = 0.8;
const GRADE_REWARD = 0.28;
const NONLINEAR_ADJUSTMENT = 0.02;

function calculateEase(ease: number, grade: number): number {
  let newEase =
    ease -
    EASE_DECAY +
    GRADE_REWARD * grade -
    NONLINEAR_ADJUSTMENT * grade * grade;

  if (newEase < MIN_EASE) {
    newEase = MIN_EASE;
  }

  return newEase;
}
