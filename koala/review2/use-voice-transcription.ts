import { trpc } from "@/koala/trpc-config";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { LangCode } from "@/koala/shared-types";

interface UseVoiceTranscriptionOptions {
  targetText?: string;
  langCode: LangCode;
}

interface TranscriptionResult {
  transcription: string;
  isMatch?: boolean;
}

export function useVoiceTranscription({
  targetText,
  langCode,
}: UseVoiceTranscriptionOptions) {
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  const transcribe = async (
    base64Audio: string,
  ): Promise<TranscriptionResult> => {
    const { result: transcription } = await transcribeAudio.mutateAsync({
      audio: base64Audio,
      lang: langCode,
      targetText: targetText || "",
    });

    const result: TranscriptionResult = { transcription };

    if (targetText) {
      result.isMatch = compare(targetText, transcription);
    }

    return result;
  };

  return {
    transcribe,
    isLoading: transcribeAudio.isLoading,
    error: transcribeAudio.error,
  };
}
