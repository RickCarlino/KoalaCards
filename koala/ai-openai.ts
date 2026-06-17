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
import type { TextModel } from "./ai-types";

const DEFAULT_MODEL: LanguageModelIdentifier = "fast";
const DEFAULT_IMAGE_MODEL: ImageModelIdentifier = "imageDefault";
const DEFAULT_IMAGE_SIZE = "1024x1024" as const;
type ModelKind = TextModel | ImageModelIdentifier;

const registry: Record<ModelKind, string> = {
  fast: "gpt-5.4-nano",
  cheap: "gpt-5.4-mini",
  good: "gpt-5.4",
  imageDefault: "gpt-image-1.5",
};

type ReasoningEffortLevel = Exclude<ReasoningEffort, null>;
type ReasoningMap = Record<TextModel, ReasoningEffortLevel>;

const REASONING_EFFORT: ReasoningMap = {
  fast: "low",
  cheap: "medium",
  good: "medium",
};

type CompletionParams = Partial<ChatCompletionCreateParamsNonStreaming>;

function getModelString(
  identifier:
    | LanguageModelIdentifier
    | ImageModelIdentifier = DEFAULT_MODEL,
): string {
  const modelString = registry[identifier as ModelKind];
  if (!modelString) {
    throw new Error(`Unknown model key "${identifier}"`);
  }
  return modelString;
}

let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const contentOf = (r: ChatCompletion): string =>
  r.choices?.[0]?.message?.content?.toString() ?? "";

const isGpt5Model = (modelName: string): boolean => {
  return modelName.startsWith("gpt-5");
};

const completionTokenLimitFrom = (
  maxTokens: number | undefined,
): number | undefined => {
  if (typeof maxTokens !== "number") {
    return undefined;
  }

  return maxTokens;
};

const reasoningEffortFor = (
  modelName: string,
  model: LanguageModelIdentifier,
): ReasoningEffortLevel | undefined => {
  if (!isGpt5Model(modelName)) {
    return undefined;
  }

  return REASONING_EFFORT[model];
};

const applyReasoningCompletionParams = (
  params: CompletionParams,
  options: {
    model: LanguageModelIdentifier;
    modelName: string;
    maxTokens: number | undefined;
  },
): void => {
  const reasoningEffort = reasoningEffortFor(
    options.modelName,
    options.model,
  );
  const completionTokenLimit = completionTokenLimitFrom(options.maxTokens);

  if (reasoningEffort) {
    params.reasoning_effort = reasoningEffort;
  }

  if (reasoningEffort === "low") {
    params.verbosity = "low";
  }

  if (completionTokenLimit !== undefined) {
    params.max_completion_tokens = completionTokenLimit;
  }
};

const buildTextCompletionParams = (options: {
  model: LanguageModelIdentifier;
  modelName: string;
  maxTokens: number | undefined;
}): CompletionParams => {
  const params: CompletionParams = {};
  applyReasoningCompletionParams(params, options);
  return params;
};

const buildStructuredCompletionParams = (options: {
  model: LanguageModelIdentifier;
  modelName: string;
  maxTokens: number | undefined;
}): CompletionParams => {
  const params: CompletionParams = {};
  if (!isGpt5Model(options.modelName)) {
    return params;
  }

  applyReasoningCompletionParams(params, options);
  return params;
};

export const openaiGenerateText: LanguageGenFn = async (options) => {
  const model = options.model ?? DEFAULT_MODEL;
  const modelName = getModelString(model);
  const completionParams = buildTextCompletionParams({
    model,
    modelName,
    maxTokens: options.maxTokens,
  });

  const result = await getOpenAIClient().chat.completions.create({
    model: modelName,
    messages: options.messages,
    ...completionParams,
  });
  return contentOf(result);
};

export const openaiGenerateStructuredOutput: StructuredGenFn = async (
  options,
) => {
  const model = options.model ?? DEFAULT_MODEL;
  const modelName = getModelString(model);
  const completionParams = buildStructuredCompletionParams({
    model,
    modelName,
    maxTokens: options.maxTokens,
  });

  const res = await getOpenAIClient().chat.completions.parse({
    model: modelName,
    messages: options.messages,
    response_format: zodResponseFormat(options.schema, "result"),
    ...completionParams,
  });
  return res.choices?.[0]?.message?.parsed;
};

export const openaiGenerateImage: ImageGenFn = async (options) => {
  const result = await getOpenAIClient().images.generate({
    model: getModelString(options.model ?? DEFAULT_IMAGE_MODEL),
    prompt: options.prompt,
    size: DEFAULT_IMAGE_SIZE,
    response_format: "b64_json",
  });
  return result.data?.[0]?.b64_json ?? "";
};
