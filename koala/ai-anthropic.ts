import z from "zod";
import {
  CoreMessage,
  LanguageModelIdentifier,
} from "./ai";

export async function anthropicGenerateText(_options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
}): Promise<string> {
  throw new Error("Not implemented");
}

export function anthropicGenerateStructuredOutput<
  S extends z.ZodTypeAny,
>(_options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  schema: S;
}): Promise<z.infer<S>>;
export async function anthropicGenerateStructuredOutput(_options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  schema: z.ZodTypeAny;
}): Promise<never> {
  throw new Error("Not implemented");
}
