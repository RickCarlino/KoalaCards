import { openai as originalOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  createProviderRegistry,
  customProvider,
  wrapLanguageModel,
  defaultSettingsMiddleware,
} from "ai";

export const registry = createProviderRegistry(
  {
    openai: customProvider({
      languageModels: {
        fast: originalOpenAI("gpt-4o-mini"),
        smart: originalOpenAI("gpt-4o"),
        creative: wrapLanguageModel({
          model: originalOpenAI("gpt-4o"),
          middleware: defaultSettingsMiddleware({
            settings: { temperature: 1.0, maxTokens: 2000 },
          }),
        }),
        reasoning: wrapLanguageModel({
          model: originalOpenAI("gpt-4o"),
          middleware: defaultSettingsMiddleware({
            settings: { temperature: 0.3, maxTokens: 4000 },
          }),
        }),
        "gpt-4o": originalOpenAI("gpt-4o"),
        "gpt-4o-mini": originalOpenAI("gpt-4o-mini"),
        "gpt-4": originalOpenAI("gpt-4"),
      },
      textEmbeddingModels: {
        default: originalOpenAI.textEmbeddingModel("text-embedding-3-small"),
        large: originalOpenAI.textEmbeddingModel("text-embedding-3-large"),
      },
      imageModels: {
        default: originalOpenAI.image("dall-e-3"),
        fast: originalOpenAI.image("dall-e-2"),
      },
      fallbackProvider: originalOpenAI,
    }),

    anthropic: customProvider({
      languageModels: {
        fast: anthropic("claude-3-haiku-20240307"),
        smart: anthropic("claude-3-5-sonnet-20241022"),
        opus: anthropic("claude-3-opus-20240229"),
        "claude-3-5-sonnet-20241022": anthropic("claude-3-5-sonnet-20241022"),
        "claude-3-haiku-20240307": anthropic("claude-3-haiku-20240307"),
        "claude-3-opus-20240229": anthropic("claude-3-opus-20240229"),
      },
      fallbackProvider: anthropic,
    }),
  },
  { separator: ":" },
);

// Default models
export const getDefaultTextModel = () => {
  return registry.languageModel("openai:smart");
};

export const getDefaultImageModel = () => {
  return registry.imageModel("openai:default");
};

export const getDefaultTranscriptionModel = (
  model: string = "gpt-4o-transcribe",
) => {
  return originalOpenAI.transcription(model);
};
