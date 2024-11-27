import { reviewReducer } from "./review-reducer";
import { ReviewState, Action } from "./types";
import { Grade } from "femto-fsrs";

describe("reviewReducer", () => {
  const initialState: ReviewState = {
    quizzes: [],
    currentQuizIndex: 0,
  };

  it("should handle LOAD_QUIZZES", () => {
    const action: Action = {
      type: "LOAD_QUIZZES",
      quizzes: [
        { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" },
        { quizId: 2, term: "term2", definition: "definition2", cardId: 2, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" },
      ],
    };
    const newState = reviewReducer(initialState, action);
    expect(newState.quizzes.length).toBe(2);
    expect(newState.currentQuizIndex).toBe(0);
  });

  it("should handle SET_GRADE", () => {
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" }, grade: Grade.GOOD },
      ],
      currentQuizIndex: 0,
    };
    const action: Action = {
      type: "SET_GRADE",
      quizId: 1,
      grade: Grade.GOOD,
    };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes[0].grade).toBe(Grade.GOOD);
  });

  it("should handle SERVER_FEEDBACK", () => {
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" }, grade: Grade.GOOD },
      ],
      currentQuizIndex: 0,
    };
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
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
      ],
      currentQuizIndex: 0,
    };
    const action: Action = {
      type: "UPDATE_AUDIO_URL",
      quizId: 1,
      audioBase64: "newAudio",
    };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes[0].quiz.termAudio).toBe("newAudio");
  });

  it("should handle NEXT_QUIZ", () => {
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
        { quiz: { quizId: 2, term: "term2", definition: "definition2", cardId: 2, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
      ],
      currentQuizIndex: 0,
    };
    const action: Action = { type: "NEXT_QUIZ" };
    const newState = reviewReducer(state, action);
    expect(newState.currentQuizIndex).toBe(1);
  });

  it("should handle FLAG_CURRENT_CARD", () => {
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
        { quiz: { quizId: 2, term: "term2", definition: "definition2", cardId: 2, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
      ],
      currentQuizIndex: 0,
    };
    const action: Action = { type: "FLAG_CURRENT_CARD" };
    const newState = reviewReducer(state, action);
    expect(newState.quizzes.length).toBe(1);
    expect(newState.quizzes[0].quiz.quizId).toBe(2);
  });
  it("should return the current state for an unknown action type", () => {
    const state: ReviewState = {
      quizzes: [
        { quiz: { quizId: 1, term: "term1", definition: "definition1", cardId: 1, definitionAudio: "", langCode: "en", lessonType: "listening", termAudio: "" } },
      ],
      currentQuizIndex: 0,
    };
    const action: any = { type: "UNKNOWN_ACTION" };
    const newState = reviewReducer(state, action);
    expect(newState).toBe(state);
  });
});
