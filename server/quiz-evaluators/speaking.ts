// import { gptCall } from "@/utils/openai";
import { QuizEvaluator } from "./types";

// const GRAMMAR_PROMPT = `
// {{sentence}}
// ---
// You the grammar of sentences inside of a language learning app.
// The sentence above was transcribed by a language learner via text to speech.
// The language code of the sentence is '{{languageCode}}'.

// Answer YES if the following are true:

// 1. The sentence is 100% grammatically correct.
// 2. The sentence is written in the correct language.
// `;

export const speaking: QuizEvaluator = async (_input) => {
  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
