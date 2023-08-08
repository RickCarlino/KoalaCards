import { gradePerformance, createCard } from "./srs";

describe("gradePerformance", () => {
  it("should increase repetitions and update interval and ease if grade is 3 or higher", () => {
    const card = createCard({
      repetitions: 0,
      interval: 1,
      ease: 2.5,
      lapses: 0,
    });

    const gradedCard = gradePerformance(card, 3);

    expect(gradedCard.repetitions).toBe(1);
    expect(gradedCard.interval).toBe(1);
    expect(gradedCard.ease).toBeGreaterThan(2.35);
  });

  it("should reset repetitions, update interval, ease and increase lapses if grade is less than 3", () => {
    const card = createCard({
      repetitions: 2,
      interval: 6,
      ease: 2.5,
      lapses: 0,
    });

    const gradedCard = gradePerformance(card, 2);

    expect(gradedCard.repetitions).toBe(0);
    expect(gradedCard.interval).toBe(1);
    expect(gradedCard.ease).toBeLessThan(2.5);
    expect(gradedCard.lapses).toBe(1);
  });
});
