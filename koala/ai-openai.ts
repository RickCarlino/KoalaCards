import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { z } from "zod";
import type { ImageModelIdentifier, LanguageModelIdentifier } from "./ai";
import type { CoreMessage, ModelKind } from "./ai-types";

const DEFAULT_MODEL: LanguageModelIdentifier = ["openai", "default"];
const DEFAULT_IMAGE_MODEL: ImageModelIdentifier = [
  "openai",
  "imageDefault",
];
const DEFAULT_IMAGE_SIZE = "1024x1024" as const;
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

const registry: Record<ModelKind, string> = {
  default: "gpt-5-nano",
  reasoning: "gpt-5",
  imageDefault: "dall-e-3",
};

function getModelString(
  identifier:
    | LanguageModelIdentifier
    | ImageModelIdentifier = DEFAULT_MODEL,
): string {
  const [vendor, modelKey] = identifier;
  if (vendor !== "openai")
    throw new Error(`Unsupported vendor: ${vendor}`);
  const modelString = registry[modelKey as ModelKind];
  if (!modelString)
    throw new Error(
      `Unknown model key "${modelKey}" for vendor "${vendor}"`,
    );
  return modelString;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const contentOf = (r: ChatCompletion): string =>
  r.choices?.[0]?.message?.content?.toString() ?? "";

export async function openaiGenerateText(options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
}) {
  const result = await openai.chat.completions.create({
    model: getModelString(options.model ?? DEFAULT_MODEL),
    messages: options.messages,
  });
  return contentOf(result);
}

export function openaiGenerateStructuredOutput<
  S extends z.ZodTypeAny,
>(options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  schema: S;
}): Promise<z.infer<S>>;
export async function openaiGenerateStructuredOutput(options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  schema: z.ZodTypeAny;
}) {
  const modelName = getModelString(options.model ?? DEFAULT_MODEL);
  const gpt5opts = {
    verbosity: "low",
    reasoning_effort: "low",
    max_completion_tokens: 1000,
  } as const;
  const res = await openai.chat.completions.parse({
    model: modelName,
    messages: options.messages,
    response_format: zodResponseFormat(options.schema, "result"),
    ...(modelName.startsWith("gpt-5") ? gpt5opts : {}),
  });
  return res.choices?.[0]?.message?.parsed;
}

export async function openaiGenerateImage(options: {
  model: ImageModelIdentifier;
  prompt: string;
}) {
  const result = await openai.images.generate({
    model: getModelString(options.model ?? DEFAULT_IMAGE_MODEL),
    prompt: options.prompt,
    size: DEFAULT_IMAGE_SIZE,
    response_format: "b64_json",
  });
  return result.data?.[0]?.b64_json ?? "";
}

export async function openaiTranscribeAudio(
  audioFile: Buffer | ArrayBuffer,
  options: { model: string; prompt?: string; filename?: string },
) {
  const filename = options?.filename ?? "input.wav";
  const prompt = options?.prompt ?? "";
  const model = options?.model ?? DEFAULT_TRANSCRIBE_MODEL;

  const data =
    audioFile instanceof ArrayBuffer
      ? new Uint8Array(audioFile)
      : audioFile;
  const file = await toFile(data, filename);
  return await openai.audio.transcriptions.create({
    model,
    file,
    prompt,
    response_format: "text",
  });
}
