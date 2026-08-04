import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import type { SpeechCreateParams } from "openai/resources/audio/speech";
import type { TranscriptionCreateParamsNonStreaming } from "openai/resources/audio/transcriptions";
import type { ImageGenerateParamsNonStreaming } from "openai/resources/images";
import type {
  ImageModelIdentifier,
  LanguageModelIdentifier,
  LanguageGenOptions,
} from "./ai";
import type { TextModel } from "./ai-types";

type ReasoningEffort = NonNullable<
  ChatCompletionCreateParamsNonStreaming["reasoning_effort"]
>;
type Verbosity = NonNullable<
  ChatCompletionCreateParamsNonStreaming["verbosity"]
>;

type TextModelProfile = {
  model: string;
  reasoningEffort: ReasoningEffort;
  verbosity?: Verbosity;
};

const TERRA_LOW_PROFILE = {
  model: "gpt-5.6-terra",
  reasoningEffort: "low",
  verbosity: "low",
} as const satisfies TextModelProfile;

const textModelProfiles: Record<TextModel, TextModelProfile> = {
  fast: TERRA_LOW_PROFILE,
  cheap: {
    model: "gpt-5.6-terra",
    reasoningEffort: "medium",
  },
  good: {
    model: "gpt-5.6-sol",
    reasoningEffort: "medium",
  },
  interactive: TERRA_LOW_PROFILE,
};

const imageModels: Record<ImageModelIdentifier, string> = {
  imageDefault: "gpt-image-2",
};

export const OPENAI_SPEECH_MODEL =
  "gpt-4o-mini-tts" as const satisfies SpeechCreateParams["model"];

export const OPENAI_TRANSCRIPTION_MODEL =
  "gpt-4o-transcribe" as const satisfies TranscriptionCreateParamsNonStreaming["model"];

export function getOpenAITextProfile(
  model: LanguageModelIdentifier,
): TextModelProfile {
  return textModelProfiles[model];
}

function buildCompletionParams(options: LanguageGenOptions) {
  const profile = getOpenAITextProfile(options.model);
  return {
    model: profile.model,
    messages: options.messages,
    reasoning_effort: profile.reasoningEffort,
    ...(profile.verbosity ? { verbosity: profile.verbosity } : {}),
    ...(options.maxTokens !== undefined
      ? { max_completion_tokens: options.maxTokens }
      : {}),
  };
}

export function buildOpenAITextRequest(
  options: LanguageGenOptions,
): ChatCompletionCreateParamsNonStreaming {
  return {
    ...buildCompletionParams(options),
    stream: false,
  } satisfies ChatCompletionCreateParamsNonStreaming;
}

export function buildOpenAIStreamingTextRequest(
  options: LanguageGenOptions,
): ChatCompletionCreateParamsStreaming {
  return {
    ...buildCompletionParams(options),
    stream: true,
  } satisfies ChatCompletionCreateParamsStreaming;
}

export function buildOpenAIImageRequest(
  model: ImageModelIdentifier,
  prompt: string,
): ImageGenerateParamsNonStreaming {
  return {
    model: imageModels[model],
    prompt,
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    n: 1,
    stream: false,
  } satisfies ImageGenerateParamsNonStreaming;
}
