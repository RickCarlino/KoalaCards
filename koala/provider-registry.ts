import { openai as originalOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createProviderRegistry, customProvider } from "ai";

const CLAUDE_35 = "claude-3-5-sonnet-20241022";

export const registry = createProviderRegistry(
  {
    openai: customProvider({
      languageModels: {
        default: originalOpenAI("gpt-5-nano"),
        // fast: originalOpenAI("gpt-5-nano"),
        // grammar: originalOpenAI("gpt-5"),
        reasoning: originalOpenAI("gpt-5"),
      },
      imageModels: {
        default: originalOpenAI.image("dall-e-3"),
        fast: originalOpenAI.image("dall-e-2"),
      },
      fallbackProvider: originalOpenAI,
    }),

    anthropic: customProvider({
      languageModels: {
        default: anthropic(CLAUDE_35),
        fast: anthropic("claude-3-haiku-20240307"),
        grammar: anthropic("claude-3-opus-20240229"),
        reasoning: anthropic("claude-3-opus-20240229"),
        [CLAUDE_35]: anthropic(CLAUDE_35),
        "claude-3-haiku-20240307": anthropic("claude-3-haiku-20240307"),
        "claude-3-opus-20240229": anthropic("claude-3-opus-20240229"),
        opus: anthropic("claude-3-opus-20240229"),
      },
      fallbackProvider: anthropic,
    }),
  },
  { separator: ":" },
);

export const getDefaultTextModel = () => {
  return registry.languageModel("openai:default");
};

export const getDefaultImageModel = () => {
  return registry.imageModel("openai:default");
};

export const getDefaultTranscriptionModel = (
  model: string = "gpt-4o-transcribe",
) => {
  return originalOpenAI.transcription(model);
};
