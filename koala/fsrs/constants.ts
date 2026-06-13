export const TS_FSRS_VERSION = "5.4.0";

export const DEFAULT_SCHEDULER_FLAGS = {
  enable_fuzz: true,
  enable_short_term: false,
} as const;

export const REVIEW_LOG_COVERAGE_COMPLETE = "COMPLETE";
export const REVIEW_LOG_COVERAGE_PARTIAL = "PARTIAL";

export const FSRS_REVIEW_LOG_CUTOFF = new Date("2026-05-28T00:00:00.000Z");

export const OPTIMIZATION_MIN_COMPLETE_LOGS = 250;
export const OPTIMIZATION_MIN_COMPLETE_CARDS = 50;
export const OPTIMIZATION_MIN_NEW_COMPLETE_LOGS = 250;
export const OPTIMIZATION_COOLDOWN_DAYS = 14;
