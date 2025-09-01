import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import { transcribeBlob } from "@/koala/utils/transcribe-blob";
import type { GradingResult } from "./types";

interface UseVoiceGradingOptions {
  targetText: string; // For transcription accuracy (e.g., card.term)
  langCode: LangCode; // Language for transcription
  cardId: number; // Card ID for server grading
  cardUUID: string; // Card UUID for storing results
  onGradingResultCaptured?: (
    cardUUID: string,
    result: GradingResult,
  ) => void; // Callback to store results
}

export function useVoiceGrading(options: UseVoiceGradingOptions) {
  const {
    cardId,
    cardUUID,
    onGradingResultCaptured,
    langCode,
    targetText,
  } = options;
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const gradeAudio = async (blob: Blob): Promise<GradingResult> => {
    // Step 1: Transcribe audio via Next API (no base64)
    const transcription = await transcribeBlob(blob, langCode, targetText);

    // Step 2: Grade the transcription
    const { isCorrect, feedback, quizResultId } =
      await gradeSpeakingQuiz.mutateAsync({
        userInput: transcription,
        cardID: cardId,
      });

    const result = {
      transcription,
      isCorrect,
      feedback,
      quizResultId: quizResultId ?? null,
    };

    // Store the grading result in state
    if (onGradingResultCaptured) {
      onGradingResultCaptured(cardUUID, result);
    }

    return result;
  };

  return {
    gradeAudio,
    isLoading: gradeSpeakingQuiz.isLoading,
    error: gradeSpeakingQuiz.error,
  };
}
