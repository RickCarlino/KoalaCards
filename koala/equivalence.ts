import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "./openai";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { translate } from "./translate";
import { compare } from "./quiz-evaluators/evaluator-utils";

export type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
};

const zodGradeResponse = z.object({
  evaluation: z.enum(["yes", "no"]),
});

const PASS = {
  result: "pass",
  userMessage: "OK",
} as const;
const SYSTEM_PROMPT = `
**System Prompt:**

You are a translation equivalence evaluator. Your sole task is to determine whether a student’s translation of an English sentence into a target language conveys the same meaning as the original sentence. Do not assess grammar, style, or fluency unless these issues alter the overall meaning. Your evaluation should be based solely on semantic equivalence. Follow these guidelines:

1. **Core Meaning:**  
   - Focus on whether the student’s translation preserves the essential information, intent, and context of the English sentence.
   - Ignore variations in syntax, word order, or phrasing as long as the meaning remains the same.

2. **Linguistic Nuance:**  
   - Recognize that the target language may naturally omit or express elements differently (e.g., pronouns in languages like Korean or differences in tense usage).  
   - Do not penalize omissions or changes that are linguistically appropriate for the target language and do not alter the core meaning.

3. **Lexical Variation:**  
   - Accept synonyms, idiomatic expressions, or alternate phrasings that accurately reflect the original meaning.
   - Be cautious if key vocabulary is mistranslated or if essential details are missing, as this can change the meaning.

4. **Evaluation Outcome:**  
   - Respond with “YES” if the translation accurately and fully conveys the meaning of the English sentence, or “NO” if it does not.

Your evaluation should be fair and lenient enough to allow natural language variation while ensuring that any translation marked as equivalent does not reinforce an incorrect meaning.
`;

const buildPrompt = (props: GrammarCorrectionProps): string =>
  [
    `### Target Sentence: "${props.term}".`,
    `### Example Acceptable answer: "${props.definition}".`,
    `### User Input: "${props.userInput}".`,
    "(YES/NO) Does Sentence A more-or-less mean the same thing as Sentence B?",
    "Meanings do not need to be 100% exact, just mostly the same.",
  ].join("\n");

// Main function for grammar correction
export const equivalence: QuizEvaluator = async (input) => {
  const model = "gpt-4o";
  const { term, definition, langCode } = input.card;
  const { userInput } = input;
  const prompt = buildPrompt({ term, definition, langCode, userInput });

  const check = async () => {
    const response = await openai.beta.chat.completions.parse({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      model,
      max_tokens: 125,
      temperature: 0.1,
      response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
      store: true,
    });
    return response.choices[0]?.message?.parsed;
  };

  const gradeResponses = await Promise.all([check(), check()]);
  const passing = gradeResponses.map((x) => x?.evaluation).includes("yes");
  if (passing) {
    return PASS;
  } else {
    return await handleFailure(langCode, userInput, definition);
  }
};

async function handleFailure(
  langCode: string,
  userInput: string,
  definition: string,
): Promise<{ result: "fail" | "pass"; userMessage: string }> {
  const englishTranslation = await translate(langCode, userInput);
  if (compare(englishTranslation, definition)) {
    return PASS;
  }
  return {
    result: "fail",
    userMessage: `Incorrect response. Your sentence translates to '${englishTranslation}'.`,
  };
}

// const PROMPT2 = `
// You are a ${language} quiz grading machine.
// You provide assesments of ${language} language quizzes.

// STUDENT QUIZ QUESTION: Say "Ask the teacher." in ${language}.
// STUDENT'S INPUT: "선생님께서 여쭈어요".

// Label the student's sentence as "Correct" or "Incorrect".

// First, think of the many ways you could say "Ask the teacher." in ${language}.
// Then, in one sentence or less, tell the student (not me) why they are or are not correct.
// You will be penalized for lengthy responses or mirroring statements.
// You only point out incorrectness, do not suggest alternatives.
// `