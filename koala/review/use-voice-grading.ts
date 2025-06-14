import { trpc } from "@/koala/trpc-config";
import { LangCode } from "@/koala/shared-types";

interface UseVoiceGradingOptions {
  targetText: string; // For transcription accuracy (e.g., card.term)
  langCode: LangCode; // Language for transcription
  quizId: number; // Quiz ID for server grading
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

export function useVoiceGrading({
  targetText,
  langCode,
  quizId,
  cardUUID,
  onGradingResultCaptured,
}: UseVoiceGradingOptions) {
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const gradeAudio = async (
    base64Audio: string,
  ): Promise<GradingResult> => {
    // Step 1: Transcribe audio
    const { result: transcription } = await transcribeAudio.mutateAsync({
      audio: base64Audio,
      targetText, // Helps with transcription accuracy
      lang: langCode,
    });

    // Step 2: Grade the transcription
    const { isCorrect, feedback } = await gradeSpeakingQuiz.mutateAsync({
      userInput: transcription,
      quizID: quizId,
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
    isLoading: transcribeAudio.isLoading || gradeSpeakingQuiz.isLoading,
    error: transcribeAudio.error || gradeSpeakingQuiz.error,
  };
}
