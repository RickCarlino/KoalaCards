import { z } from "zod";
import { generateAIText, generateStructuredOutput } from "../ai";
import { containsHangul } from "../utils/hangul";

export type DetectedSourceLanguage = "ko" | "en" | "other";

const languageDetectionSchema = z.object({
  language: z.enum(["ko", "en", "other"]),
});

const englishLetterCount = (text: string): number => {
  const matches = text.match(/[A-Za-z]/g);
  return matches ? matches.length : 0;
};

const visibleCharacterCount = (text: string): number => {
  const matches = text.match(/[^\s]/g);
  return matches ? matches.length : 0;
};

const looksLikeEnglish = (text: string): boolean => {
  const letters = englishLetterCount(text);
  const visibleChars = visibleCharacterCount(text);

  if (letters < 30) {
    return false;
  }

  if (visibleChars === 0) {
    return false;
  }

  return letters / visibleChars > 0.45;
};

export const detectSourceLanguage = async (
  text: string,
): Promise<DetectedSourceLanguage> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "other";
  }

  if (containsHangul(trimmed)) {
    return "ko";
  }

  if (looksLikeEnglish(trimmed)) {
    return "en";
  }

  const sample = trimmed.slice(0, 2500);

  try {
    const detection = await generateStructuredOutput({
      model: "cheap",
      schema: languageDetectionSchema,
      messages: [
        {
          role: "system",
          content:
            "Identify the language of the text. Return ko for Korean, en for English, and other for anything else.",
        },
        {
          role: "user",
          content: sample,
        },
      ],
      maxTokens: 120,
    });

    return detection.language;
  } catch {
    return "other";
  }
};

const splitIntoChunks = (text: string, chunkSize: number): string[] => {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      let start = 0;
      while (start < paragraph.length) {
        chunks.push(paragraph.slice(start, start + chunkSize).trim());
        start += chunkSize;
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length > chunkSize && current) {
      chunks.push(current.trim());
      current = paragraph;
      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
};

export const translateEnglishToKorean = async (
  englishText: string,
): Promise<string> => {
  const trimmed = englishText.trim();
  if (!trimmed) {
    return "";
  }

  const chunks = splitIntoChunks(trimmed, 2600);
  const translatedChunks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const translated = await generateAIText({
      model: "good",
      messages: [
        {
          role: "system",
          content: [
            "You are an expert English-to-Korean translator.",
            "Translate every sentence fully into Korean.",
            "Use simple, easy-to-understand Korean targetting intermediate language learners.",
            "Do not summarize, shorten, omit, or add content.",
            "Return only Korean translation.",
            "Focus on sounding like a native Korean speaker, not a machine translation.",
            "Strip out artifacts from the source so that the article is clean markdown in Korean.",
            "If it is not part of the article (nav bar content, ad, 'read more' link, etc.), remove it from the final article.",
            "We need the whole article, as a translated article, as a markdown article and nothing but the article.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Part ${index + 1} of ${chunks.length}.`,
            "Translate this text exactly and completely:",
            chunk,
          ].join("\n\n"),
        },
      ],
    });

    const normalized = translated.trim();
    if (!normalized) {
      throw new Error("Translation returned empty output.");
    }
    translatedChunks.push(normalized);
  }

  return translatedChunks.join("\n\n");
};
