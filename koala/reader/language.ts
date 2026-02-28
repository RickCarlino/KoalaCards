import { z } from "zod";
import { generateAIText, generateStructuredOutput } from "../ai";
import { containsHangul } from "../utils/hangul";

export type DetectedSourceLanguage = "ko" | "en" | "other";

type ExtractArticleInput = {
  title: string;
  description: string;
  pageText: string;
  pageHtml: string;
};

const languageDetectionSchema = z.object({
  language: z.enum(["ko", "en", "other"]),
});

const extractedArticleSchema = z.object({
  articleMarkdown: z.string(),
});

const tidyMarkdownSchema = z.object({
  markdown: z.string(),
});

const EXTRACTION_CHUNK_SIZE = 3200;
const TRANSLATION_CHUNK_SIZE = 2600;
const HTML_HINT_LENGTH = 5000;
const TIDY_INPUT_CHAR_LIMIT = 9000;

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

const normalizeMarkdownText = (text: string): string => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

export const extractArticleContentFromPage = async (
  input: ExtractArticleInput,
): Promise<string> => {
  const normalizedPageText = normalizeMarkdownText(input.pageText);
  if (!normalizedPageText) {
    return "";
  }

  const chunks = splitIntoChunks(
    normalizedPageText,
    EXTRACTION_CHUNK_SIZE,
  );
  const htmlHint = input.pageHtml.slice(0, HTML_HINT_LENGTH).trim();
  const articleSegments: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const userParts: string[] = [
      `Page title: ${input.title || "(none)"}`,
      `Page description: ${input.description || "(none)"}`,
    ];

    if (index === 0 && htmlHint) {
      userParts.push(`HTML context snippet:\n${htmlHint}`);
    }

    userParts.push(
      `Text chunk ${index + 1} of ${chunks.length}:\n${chunk}`,
    );

    const extracted = await generateStructuredOutput({
      model: "good",
      schema: extractedArticleSchema,
      messages: [
        {
          role: "system",
          content: [
            "Extract only the main article body from the provided webpage text chunk.",
            "Keep the original language exactly as-is and keep original ordering.",
            "Remove navigation labels, related links, comments, ads, newsletter prompts, legal/footer boilerplate, and non-article widgets.",
            "Return markdown only.",
            "Seriosuly, do not return things like links to related articles, share prompts, newsletter signups, nav bars, buttons, etc.. Focus on the core article content.",
            "If this chunk has no article body content, return an empty string.",
          ].join(" "),
        },
        {
          role: "user",
          content: userParts.join("\n\n"),
        },
      ],
      maxTokens: 2200,
    });

    const normalizedSegment = normalizeMarkdownText(
      extracted.articleMarkdown,
    );

    if (normalizedSegment) {
      articleSegments.push(normalizedSegment);
    }
  }

  return normalizeMarkdownText(articleSegments.join("\n\n"));
};

export const translateEnglishToKorean = async (
  englishText: string,
): Promise<string> => {
  const trimmed = normalizeMarkdownText(englishText);
  if (!trimmed) {
    return "";
  }

  const chunks = splitIntoChunks(trimmed, TRANSLATION_CHUNK_SIZE);
  const translatedChunks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const translated = await generateAIText({
      model: "good",
      messages: [
        {
          role: "system",
          content: [
            "You are an expert English-to-Korean translator serving the needs of intermediate Korean language learners.",
            "Translate all English content into Korean.",
            "Preserve markdown structure and ordering.",
            "Keep markdown syntax, links, and headings valid.",
            "Do not summarize or omit content.",
            "Return only translated markdown.",
            "Use natural, fluent Korean that a native speaker would use with vocabulary suitable for intermediate learners.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Part ${index + 1} of ${chunks.length}.`,
            "Translate this markdown to Korean:",
            chunk,
          ].join("\n\n"),
        },
      ],
    });

    const normalized = normalizeMarkdownText(translated);
    if (!normalized) {
      throw new Error("Translation returned empty output.");
    }
    translatedChunks.push(normalized);
  }

  return normalizeMarkdownText(translatedChunks.join("\n\n"));
};

export const tidyKoreanArticleMarkdown = async (
  koreanMarkdown: string,
): Promise<string> => {
  const trimmed = normalizeMarkdownText(koreanMarkdown);
  if (!trimmed) {
    return "";
  }

  const truncatedInput = trimmed.slice(0, TIDY_INPUT_CHAR_LIMIT);

  const tidyResult = await generateStructuredOutput({
    model: "good",
    schema: tidyMarkdownSchema,
    messages: [
      {
        role: "system",
        content: [
          "You are a Korean copy editor for reading content.",
          "Clean and format the article as tidy markdown.",
          "Keep full article meaning and ordering.",
          "Remove any leftover non-article noise such as share prompts, related links, or widget text.",
          "Use readable paragraph breaks and headings where appropriate.",
          "Return only markdown.",
        ].join(" "),
      },
      {
        role: "user",
        content: truncatedInput,
      },
    ],
  });

  const normalized = normalizeMarkdownText(tidyResult.markdown);
  if (!normalized) {
    throw new Error("Markdown cleanup returned empty output.");
  }

  return normalized;
};
