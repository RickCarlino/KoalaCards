import { shuffle } from "radash";
import { evenlyDistribute } from "../evenly-distribute";

describe("evenlyDistribute", () => {
  it("should evenly distribute elements based on the specified key", () => {
    interface TestValue {
      id: string;
      value: number;
    }

    const input: TestValue[] = shuffle([
      { value: 24, id: "FIRST" },
      { value: 26, id: "SECOND" },
      { value: 27, id: "THIRD" },
      { value: 28, id: "FOURTH" },
      { value: 29, id: "FIFTH" },
      { value: 31, id: "SIXTH" },
      { value: 32, id: "SEVENTH" },
      { value: 33, id: "EIGHTH" },
      { value: 36, id: "NINTH" },
      { value: 37, id: "LAST" },
    ]);

    const actual = evenlyDistribute(input, "value");
    expect(actual[0].id).toEqual("FIRST");
    expect(actual[0].value).toEqual(24);
    expect(actual[1].id).toEqual("SECOND");
    expect(actual[3].id).toEqual("FOURTH");
    expect(actual[actual.length - 1].id).toEqual("LAST");
    expect(actual[actual.length - 1].value).toEqual(37);

    type TestCase = { input: number[]; output: number[] };
    const testCases: TestCase[] = [
      { input: [1, 2, 3], output: [1, 2, 3] },
      { input: [], output: [] },
      { input: [1], output: [1] },
      { input: [1, 2], output: [1, 2] },
      { input: [2, 1], output: [2, 1] },
      { input: [4, 1, 3, 2], output: [1, 2, 3, 4] },
      { input: [4, 3, 2, 1], output: [1, 2, 3, 4] },
      { input: [30, 11, 10], output: [10, 20, 30] },
      { input: [10, 30, 11], output: [10, 20, 30] },
      { input: [11, 10, 30], output: [10, 20, 30] },
    ];

    testCases.forEach(({ input, output }) => {
      const createFakes = (value: number) => ({ value });
      const actual = evenlyDistribute(input.map(createFakes), "value");
      const expected = output.map(createFakes);
      expect(actual).toEqual(expected);
    });
  });
});
