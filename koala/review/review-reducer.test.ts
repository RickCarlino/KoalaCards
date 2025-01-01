import { LessonType } from "../shared-types";
import { reviewReducer } from "./review-reducer";
import { ReviewState, Action } from "./types";
import { Grade } from "femto-fsrs";

describe("reviewReducer", () => {
  const createQuiz = (
    quizId: number,
    term: string,
    definition: string,
    lessonType: LessonType = "listening",
  ) => ({
    quizId,
    term,
    definition,
    cardId: quizId,
    definitionAudio: "",
    langCode: "en",
    lessonType,
    termAudio: "",
  });

  const createState = (quizzes: any[], currentQuizIndex = 0): ReviewState => ({
    quizzes: quizzes.map((quiz) => ({ quiz })),
    currentQuizIndex,
  });

  it("should handle LOAD_QUIZZES", () => {
    const action: Action = {
      type: "LOAD_QUIZZES",
      quizzes: [
        createQuiz(1, "term1", "definition1", "listening"),
        createQuiz(2, "term2", "definition2", "listening"),
      ],
    };
    const newState = reviewReducer(createState([]), action);
    expect(newState.quizzes.length).toBe(2);
    expect(newState.currentQuizIndex).toBe(0);
  });

  it("should handle SET_GRADE", () => {
    const state = createState([
      { ...createQuiz(1, "term1", "definition1"), grade: Grade.GOOD },
    ]);
    const action: Action = {
      type: "SET_GRADE",
      quizId: 1,
      grade: Grade.GOOD,
    };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes[0].grade).toBe(Grade.GOOD);
  });

  it("should handle SERVER_FEEDBACK", () => {
    const state = createState([
      { ...createQuiz(1, "term1", "definition1"), grade: Grade.GOOD },
    ]);
    const action: Action = {
      type: "SERVER_FEEDBACK",
      quizId: 1,
      result: "fail",
      serverResponse: "Try again",
      userResponse: "response",
    };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes[0].serverGradingResult).toBe("fail");
    expect(newState.quizzes[0].serverResponse).toBe("Try again");
    expect(newState.quizzes[0].grade).toBe(Grade.AGAIN);
  });

  it("should handle UPDATE_AUDIO_URL", () => {
    const state = createState([createQuiz(1, "term1", "definition1")]);
    const action: Action = {
      type: "UPDATE_AUDIO_URL",
      quizId: 1,
      audioBase64: "newAudio",
    };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes[0].quiz.termAudio).toBe("newAudio");
  });

  it("should handle NEXT_QUIZ", () => {
    const state = createState([
      createQuiz(1, "term1", "definition1"),
      createQuiz(2, "term2", "definition2"),
    ]);
    const action: Action = { type: "NEXT_QUIZ" };
    const newState = reviewReducer(state, action);
    expect(newState.currentQuizIndex).toBe(1);
  });

  it("should handle PAUSE_CURRENT_CARD", () => {
    const state = createState([
      createQuiz(1, "term1", "definition1"),
      createQuiz(2, "term2", "definition2"),
    ]);
    const action: Action = { type: "PAUSE_CURRENT_CARD" };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes.length).toBe(1);
    expect(newState.quizzes[0].quiz.quizId).toBe(2);
  });

  it("should return the current state for an unknown action type", () => {
    const state = createState([createQuiz(1, "term1", "definition1")]);
    const action: any = { type: "UNKNOWN_ACTION" };
    const newState = reviewReducer(state, action);
    expect(newState).toBe(state);
  });
});
