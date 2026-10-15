import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import type { SpeechCreateParams } from "openai/resources/audio/speech";
import type { TranscriptionCreateParamsNonStreaming } from "openai/resources/audio/transcriptions";
import type { ImageGenerateParamsNonStreaming } from "openai/resources/images";
import type { DecisionCreateParams } from "openai/resources/decisions";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type {
  ImageModelIdentifier,
  LanguageModelIdentifier,
  LanguageGenOptions,
  ChoiceGenOptions,
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
  explanation: {
    model: "gpt-6.1-sol",
    reasoningEffort: "medium",
    verbosity: "low",
  },
};

const imageModels: Record<ImageModelIdentifier, string> = {
  imageDefault: "gpt-image-2",
};

export const OPENAI_DECISION_MODEL = "gpt-6-luna";

export function buildOpenAIChoiceRequest(
  options: ChoiceGenOptions,
): DecisionCreateParams {
  return {
    model: OPENAI_DECISION_MODEL,
    input: options.input,
    questions: [
      {
        type: "choice",
        name: "classification",
        instructions: options.instructions,
        choices: options.choices,
      },
    ],
  };
}

export function buildOpenAIResponseRequest(
  options: LanguageGenOptions,
): ResponseCreateParamsNonStreaming {
  const profile = getOpenAITextProfile(options.model);
  return {
    model: profile.model,
    store: false,
    input: options.messages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : message.content.map((part) => part.text).join("\n"),
    })),
    reasoning: { effort: profile.reasoningEffort },
    text: { verbosity: profile.verbosity ?? "low" },
    ...(options.maxTokens !== undefined
      ? { max_output_tokens: options.maxTokens }
      : {}),
  };
}

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
