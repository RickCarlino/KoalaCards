import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type {
  ImageGenFn,
  LanguageGenFn,
  LanguageStreamGenFn,
  StructuredGenFn,
  ChoiceGenOptions,
} from "./ai";
import {
  buildOpenAIImageRequest,
  buildOpenAIStreamingTextRequest,
  buildOpenAITextRequest,
  buildOpenAIChoiceRequest,
  buildOpenAIResponseRequest,
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

const choiceResponseSchema = z.object({
  model: z.string().min(1),
  answers: z.tuple([
    z.object({
      type: z.literal("choice"),
      name: z.literal("classification"),
      choice: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ]),
});

export async function openaiClassifyChoice(options: ChoiceGenOptions) {
  const result = choiceResponseSchema.parse(
    await getOpenAIClient().decisions.create(
      buildOpenAIChoiceRequest(options),
      { timeout: 15_000, maxRetries: 1 },
    ),
  );
  const answer = result.answers[0];
  if (!options.choices.some(({ value }) => value === answer.choice)) {
    throw new Error("Decision returned an unsupported choice");
  }
  return {
    choice: answer.choice,
    confidence: answer.confidence,
    model: result.model,
  };
}

export const openaiGenerateResponseStructuredOutput: StructuredGenFn =
  async (options) => {
    const request = buildOpenAIResponseRequest(options);
    const response = await getOpenAIClient().responses.parse(
      {
        ...request,
        text: {
          ...request.text,
          format: zodTextFormat(options.schema, "result"),
        },
      },
      { timeout: 60_000, maxRetries: 0 },
    );
    if (response.status !== "completed") {
      throw new Error("Explanation did not complete");
    }
    return options.schema.parse(response.output_parsed);
  };

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
