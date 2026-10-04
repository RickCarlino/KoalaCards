import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type {
  ImageGenFn,
  LanguageGenFn,
  LanguageStreamGenFn,
  StructuredGenFn,
} from "./ai";
import {
  buildOpenAIImageRequest,
  buildOpenAIStreamingTextRequest,
  buildOpenAITextRequest,
} from "./ai-openai-config";

let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const contentOf = (r: ChatCompletion): string =>
  r.choices?.[0]?.message?.content?.toString() ?? "";

export const openaiGenerateText: LanguageGenFn = async (options) => {
  const result = await getOpenAIClient().chat.completions.create(
    buildOpenAITextRequest(options),
  );
  return contentOf(result);
};

export const openaiStreamText: LanguageStreamGenFn = async function* (
  options,
) {
  const stream = await getOpenAIClient().chat.completions.create(
    buildOpenAIStreamingTextRequest(options),
  );

  for await (const part of stream) {
    const content = part.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
};

export const openaiGenerateStructuredOutput: StructuredGenFn = async (
  options,
) => {
  const res = await getOpenAIClient().chat.completions.parse({
    ...buildOpenAITextRequest(options),
    response_format: zodResponseFormat(options.schema, "result"),
  });
  return options.schema.parse(res.choices?.[0]?.message?.parsed);
};

export const openaiGenerateImage: ImageGenFn = async (options) => {
  const result = await getOpenAIClient().images.generate(
    buildOpenAIImageRequest(options.model, options.prompt),
  );
  return result.data?.[0]?.b64_json ?? "";
};
