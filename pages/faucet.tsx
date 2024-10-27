import React from "react";
import { ReviewOver } from "@/koala/review/review-over";
import { Grade } from "femto-fsrs";
import { QuizState } from "@/koala/review/types";

/** The faucet component has a button that when clicked
 * calls the "faucet" trpc mutation:
 */
export default function Faucet(_props: {}) {
  const state: QuizState[] = [
    {
      quiz: {
        langCode: "ko",
        term: "The term.",
        definition: "The definition.",
        // repetitions: 0,
        // lapses: 0,
        // lastReview: 0,
        quizId: 0,
        cardId: 0,
        lessonType: "speaking",
        definitionAudio: "",
        // termAudio: "",
        imageURL: undefined,
      },
      response: "???",
      grade: Grade.AGAIN,
      serverGradingResult: "fail",
      serverResponse: "??", // Response from the server (e.g., transcription)
    },
  ];
  const props = {
    state,
    async onSave() {
      alert("TODO: Finalize review session");
    },
    onUpdateDifficulty(quizId: number, grade: Grade) {
      alert(`TODO: Update quiz ${quizId} with grade ${grade}`);
    },
    moreQuizzesAvailable: false,
  };
  return <ReviewOver {...props} />;
}
