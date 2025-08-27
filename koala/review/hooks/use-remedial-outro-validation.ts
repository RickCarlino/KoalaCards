import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import { GradingResult } from "../types";

interface UseRemedialOutroValidationOptions {
  targetText: string;
  langCode: LangCode;
  cardId: number;
  cardUUID: string;
  onValidationComplete?: (isValid: boolean, result: GradingResult) => void;
}

/**
 * Hook for validating remedial outro responses in speaking exams
 * This provides a simpler interface specifically for validation without audio transcription
 */
export function useRemedialOutroValidation({
  cardId,
  onValidationComplete,
}: UseRemedialOutroValidationOptions) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<GradingResult | null>(null);

  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const validateTranscription = async (
    userTranscription: string,
  ): Promise<GradingResult> => {
    setIsValidating(true);

    try {
      // Validate the transcription using the existing grading logic
      const { isCorrect, feedback } = await gradeSpeakingQuiz.mutateAsync({
        userInput: userTranscription,
        cardID: cardId,
      });

      const result: GradingResult = {
        transcription: userTranscription,
        isCorrect,
        feedback,
      };

      setValidationResult(result);

      if (onValidationComplete) {
        onValidationComplete(isCorrect, result);
      }

      return result;
    } catch (error) {
      console.error("Validation error:", error);

      const errorResult: GradingResult = {
        transcription: userTranscription,
        isCorrect: false,
        feedback: "An error occurred while validating your response.",
      };

      setValidationResult(errorResult);

      if (onValidationComplete) {
        onValidationComplete(false, errorResult);
      }

      return errorResult;
    } finally {
      setIsValidating(false);
    }
  };

  const resetValidation = () => {
    setValidationResult(null);
    setIsValidating(false);
  };

  return {
    validateTranscription,
    isValidating,
    validationResult,
    resetValidation,
    error: gradeSpeakingQuiz.error,
  };
}
