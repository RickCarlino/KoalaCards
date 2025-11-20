import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";
import type {
  ImageModelIdentifier,
  LanguageModelIdentifier,
  ImageGenFn,
  LanguageGenFn,
  StructuredGenFn,
} from "./ai";
import type { ModelKind, TextModel } from "./ai-types";

const DEFAULT_MODEL: LanguageModelIdentifier = ["openai", "fast"];
const DEFAULT_IMAGE_MODEL: ImageModelIdentifier = [
  "openai",
  "imageDefault",
];
const DEFAULT_IMAGE_SIZE = "1024x1024" as const;

const registry: Record<ModelKind, string> = {
  fast: "gpt-5.1",
  cheap: "gpt-5-mini",
  good: "gpt-5-mini", // GPT 5 too expensive for general use. Testing a mini everywhere approach.
  imageDefault: "dall-e-3",
};

type ReasoningEffortLevel = Exclude<ReasoningEffort, null> | "none";
type ReasoningMap = Record<TextModel, ReasoningEffortLevel>;

const REASONING_EFFORT: ReasoningMap = {
  fast: "none",
  cheap: "minimal",
  good: "low",
};

function getModelString(
  identifier:
    | LanguageModelIdentifier
    | ImageModelIdentifier = DEFAULT_MODEL,
): string {
  const [vendor, modelKey] = identifier;
  if (vendor !== "openai") {
    throw new Error(`Unsupported vendor: ${vendor}`);
  }
  const modelString = registry[modelKey as ModelKind];
  if (!modelString) {
    throw new Error(
      `Unknown model key "${modelKey}" for vendor "${vendor}"`,
    );
  }
  return modelString;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const contentOf = (r: ChatCompletion): string =>
  r.choices?.[0]?.message?.content?.toString() ?? "";

export const openaiGenerateText: LanguageGenFn = async (options) => {
  const result = await openai.chat.completions.create({
    model: getModelString(options.model ?? DEFAULT_MODEL),
    messages: options.messages,
  });
  return contentOf(result);
};

export const openaiGenerateStructuredOutput: StructuredGenFn = async (
  options,
) => {
  const modelName = getModelString(options.model ?? DEFAULT_MODEL);
  const usesGpt5 = modelName.startsWith("gpt-5");
  const reasoningEffort = usesGpt5
    ? REASONING_EFFORT[options.model?.[1]]
    : undefined;
  const res = await openai.chat.completions.parse({
    model: modelName,
    messages: options.messages,
    response_format: zodResponseFormat(options.schema, "result"),
    ...(usesGpt5
      ? {
          verbosity: "low" as const,
          // SDK types lag the new "none" option, so cast to allow it.
          reasoning_effort:
            reasoningEffort as unknown as ChatCompletionCreateParamsNonStreaming["reasoning_effort"],
          max_completion_tokens: options.maxTokens ?? 1000,
        }
      : {}),
  });
  return res.choices?.[0]?.message?.parsed;
};

export const openaiGenerateImage: ImageGenFn = async (options) => {
  const result = await openai.images.generate({
    model: getModelString(options.model ?? DEFAULT_IMAGE_MODEL),
    prompt: options.prompt,
    size: DEFAULT_IMAGE_SIZE,
    response_format: "b64_json",
  });
  return result.data?.[0]?.b64_json ?? "";
};
