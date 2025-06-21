import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";

interface ValidationResult {
  isValid: boolean;
  feedback?: string;
}

interface ValidateRemedialOutroResponseParams {
  userTranscription: string;
  targetText: string;
  langCode: LangCode;
  quizId: number;
}

/**
 * Validates a remedial outro response for speaking exams
 * This function checks if the user's spoken response matches the expected answer
 * using the same logic as the regular speaking grading
 */
export async function validateRemedialOutroResponse({
  userTranscription,
  quizId,
}: ValidateRemedialOutroResponseParams): Promise<ValidationResult> {
  try {
    // Use the existing gradeSpeakingQuiz mutation to validate the response
    const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

    const { isCorrect, feedback } = await gradeSpeakingQuiz.mutateAsync({
      userInput: userTranscription,
      quizID: quizId,
    });

    return {
      isValid: isCorrect,
      feedback: feedback,
    };
  } catch (error) {
    console.error("Error validating remedial outro response:", error);
    return {
      isValid: false,
      feedback: "An error occurred while validating your response.",
    };
  }
}

/**
 * Hook version for easier use in React components
 */
export function useValidateRemedialOutroResponse() {
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const validate = async ({
    userTranscription,
    quizId,
  }: ValidateRemedialOutroResponseParams): Promise<ValidationResult> => {
    try {
      const { isCorrect, feedback } = await gradeSpeakingQuiz.mutateAsync({
        userInput: userTranscription,
        quizID: quizId,
      });

      return {
        isValid: isCorrect,
        feedback: feedback,
      };
    } catch (error) {
      console.error("Error validating remedial outro response:", error);
      return {
        isValid: false,
        feedback: "An error occurred while validating your response.",
      };
    }
  };

  return {
    validate,
    isLoading: gradeSpeakingQuiz.isLoading,
    error: gradeSpeakingQuiz.error,
  };
}
