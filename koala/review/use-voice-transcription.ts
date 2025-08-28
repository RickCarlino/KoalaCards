import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { LangCode } from "@/koala/shared-types";
import { transcribeBlob } from "@/koala/utils/transcribe-blob";

interface UseVoiceTranscriptionOptions {
  targetText?: string;
  langCode: LangCode;
}

interface TranscriptionResult {
  transcription: string;
  isMatch?: boolean;
}

export function useVoiceTranscription(
  options: UseVoiceTranscriptionOptions,
) {
  const { targetText, langCode } = options;
  const transcribe = async (blob: Blob): Promise<TranscriptionResult> => {
    const transcription = await transcribeBlob(blob, langCode, targetText);

    const result: TranscriptionResult = { transcription };

    if (targetText) {
      result.isMatch = compare(targetText, transcription);
    }

    return result;
  };

  return {
    transcribe,
    isLoading: false,
    error: null,
  };
}
