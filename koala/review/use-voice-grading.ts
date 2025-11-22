import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";
import { transcribeBlob } from "@/koala/utils/transcribe-blob";
import type { GradingResult } from "./types";

interface UseVoiceGradingOptions {
  targetText: string;
  langCode: LangCode;
  cardId: number;
  cardUUID: string;
  onGradingResultCaptured?: (
    cardUUID: string,
    result: GradingResult,
  ) => void;
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
    const transcription = await transcribeBlob(blob, langCode, targetText);

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
