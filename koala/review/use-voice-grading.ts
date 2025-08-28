import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import { transcribeBlob } from "@/koala/utils/transcribe-blob";

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

interface GradingResult {
  transcription: string; // What the user said
  isCorrect: boolean; // Whether it passed grading
  feedback: string; // Server feedback
}

export function useVoiceGrading(options: UseVoiceGradingOptions) {
  const { cardId, cardUUID, onGradingResultCaptured, langCode } = options;
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const gradeAudio = async (blob: Blob): Promise<GradingResult> => {
    // Step 1: Transcribe audio via Next API (no base64)
    const transcription = await transcribeBlob(blob, langCode);

    // Step 2: Grade the transcription
    const { isCorrect, feedback } = await gradeSpeakingQuiz.mutateAsync({
      userInput: transcription,
      cardID: cardId,
    });

    const result = {
      transcription,
      isCorrect,
      feedback,
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
