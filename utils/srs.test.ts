import { gradePerformance, createCard } from "./srs";

describe("gradePerformance", () => {
  it("should increase repetitions and update interval and ease if grade is 3 or higher", () => {
    const START_TIME = Date.now();
    let card = createCard({});
    let deck: (typeof card)[] = [];
    for (let i = 0; i < 8; i++) {
      i && deck.push(card); // Don't push first card into deck.
      card = gradePerformance(card, 3, START_TIME + card.interval);
    }
    const expectations = [
      "0.0035", // 5 Minutes
      "0.0417", // 1 hour
      "0.5000", // Half a day, etc..
      "2.0000",
      "4.0000",
      "8.0000",
      "14.0000",
    ];
    const actual = deck.map((card) => card.interval.toFixed(4));
    expect(actual).toEqual(expectations);
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
