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

const extractedArticleSchema = z.object({
  articleMarkdown: z.string(),
});

const tidyMarkdownSchema = z.object({
  markdown: z.string(),
});

const LENGTH = 20000;
const MIN_KOREAN_HANGUL_CHAR_COUNT = 30;
const MIN_KOREAN_HANGUL_PARAGRAPH_RATIO = 0.35;

const englishLetterCount = (text: string): number => {
  const matches = text.match(/[A-Za-z]/g);
  return matches ? matches.length : 0;
};

const visibleCharacterCount = (text: string): number => {
  const matches = text.match(/[^\s]/g);
  return matches ? matches.length : 0;
};

const hangulCharacterCount = (text: string): number => {
  const matches = text.match(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g);
  return matches ? matches.length : 0;
};

const hangulParagraphRatio = (text: string): number => {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return 0;
  }

  const hangulParagraphs = paragraphs.filter((paragraph) => {
    return containsHangul(paragraph);
  }).length;

  return hangulParagraphs / paragraphs.length;
};

const looksLikeKorean = (text: string): boolean => {
  const hangulChars = hangulCharacterCount(text);
  if (hangulChars < MIN_KOREAN_HANGUL_CHAR_COUNT) {
    return false;
  }

  return hangulParagraphRatio(text) >= MIN_KOREAN_HANGUL_PARAGRAPH_RATIO;
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

  if (looksLikeKorean(trimmed)) {
    return "ko";
  }

  if (looksLikeEnglish(trimmed)) {
    return "en";
  }

  return "other";
};

export const extractArticleContentFromPage = async (
  input: ExtractArticleInput,
): Promise<string> => {
  const normalizedPageText = normalizeMarkdownText(input.pageText);
  if (!normalizedPageText) {
    return "";
  }

  const truncatedPageText = normalizedPageText.slice(0, LENGTH);
  const htmlHint = input.pageHtml.slice(0, LENGTH).trim();

  const userParts: string[] = [
    `Page title: ${input.title || "(none)"}`,
    `Page description: ${input.description || "(none)"}`,
  ];

  if (htmlHint) {
    userParts.push(`HTML context snippet:\n${htmlHint}`);
  }

  userParts.push(`Page text:\n${truncatedPageText}`);

  const extracted = await generateStructuredOutput({
    model: "fast",
    schema: extractedArticleSchema,
    messages: [
      {
        role: "system",
        content: [
          "Extract only the main article body from the provided webpage text.",
          "DO NOT EXTRACT IT IF IT IS NOT PART OF THE ARTICLE BODY.",
          "A blog name is not an article, a nav bar is not an article, a share prompt is not an article, related links are not an article, a newsletter signup is not an article, etc..",
          "Keep the original language exactly as-is and keep original ordering.",
          "Remove navigation labels, related links, comments, ads, newsletter prompts, legal/footer boilerplate, and non-article widgets.",
          "Return markdown only.",
          "Make sure that you put code and other non-spoken content into code fences.",
          "Seriosuly, do not return things like links to related articles, share prompts, newsletter signups, nav bars, buttons, etc.. Focus on the core article content.",
          "If the page text has no article body content, return an empty string.",
        ].join(" "),
      },
      {
        role: "user",
        content: userParts.join("\n\n"),
      },
    ],
    maxTokens: LENGTH,
  });

  return normalizeMarkdownText(extracted.articleMarkdown);
};

export const translateEnglishToKorean = async (
  englishText: string,
): Promise<string> => {
  const trimmed = normalizeMarkdownText(englishText);
  if (!trimmed) {
    return "";
  }

  const truncatedInput = trimmed.slice(0, LENGTH);

  const translated = await generateAIText({
    model: "fast",
    messages: [
      {
        role: "system",
        content:
          "I am learning Korean. Translate this article to Korean so that it is easy to understand and really really natural sounding (don't make it sound like a translation of English). Use words I will understand as an intermediate learner. Preserve Markdown format. I only want a clean Korean translation of the article in markdown format in the output, nothing else.",
      },
      {
        role: "user",
        content: truncatedInput,
      },
    ],
    maxTokens: LENGTH,
  });

  const normalized = normalizeMarkdownText(translated);
  if (!normalized) {
    throw new Error("Translation returned empty output.");
  }

  return normalized;
};

export const tidyKoreanArticleMarkdown = async (
  koreanMarkdown: string,
): Promise<string> => {
  const trimmed = normalizeMarkdownText(koreanMarkdown);
  if (!trimmed) {
    return "";
  }

  const truncatedInput = trimmed.slice(0, LENGTH);

  const tidyResult = await generateStructuredOutput({
    model: "fast",
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
    maxTokens: LENGTH,
  });

  const normalized = normalizeMarkdownText(tidyResult.markdown);
  if (!normalized) {
    throw new Error("Markdown cleanup returned empty output.");
  }

  return normalized;
};
