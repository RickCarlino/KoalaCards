import { z } from "zod";
import { generateStructuredOutput } from "../ai";
import { containsHangul } from "../utils/hangul";

export type DetectedSourceLanguage = "ko" | "en" | "other";

type ExtractArticleInput = {
  title: string;
  description: string;
  pageText: string;
  pageHtml: string;
};

const pageMarkdownSchema = z.object({
  markdown: z.string(),
});

const extractedArticleSchema = z.object({
  articleMarkdown: z.string(),
});

const tidyMarkdownSchema = z.object({
  markdown: z.string(),
});

const LENGTH = 20000;
const MIN_KOREAN_HANGUL_CHAR_COUNT = 30;
const MIN_KOREAN_HANGUL_PARAGRAPH_RATIO = 0.35;
const ARTICLE_FIDELITY_RULES = [
  "Preserve source wording as faithfully as possible.",
  "Do not summarize, paraphrase, simplify, shorten, reorder, or deduplicate the article.",
  "Do not introduce repetition, bullets, headings, or takeaways unless they already appear in the source.",
  "Preserve names, dates, numbers, and original language.",
];

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
  const htmlHint = input.pageHtml.slice(0, LENGTH).trim();
  if (!normalizedPageText && !htmlHint) {
    return "";
  }

  const userParts: string[] = [
    `Page title: ${input.title || "(none)"}`,
    `Page description: ${input.description || "(none)"}`,
  ];

  if (htmlHint) {
    userParts.push(`HTML context snippet:\n${htmlHint}`);
  }

  if (normalizedPageText) {
    userParts.push(`Page text:\n${normalizedPageText.slice(0, LENGTH)}`);
  }

  const pageMarkdownResult = await generateStructuredOutput({
    model: "fast",
    schema: pageMarkdownSchema,
    messages: [
      {
        role: "system",
        content: [
          "Convert the provided webpage content into markdown for downstream article extraction.",
          "Transcribe source prose faithfully while making the article cleanly readable as markdown.",
          ...ARTICLE_FIDELITY_RULES,
          "Return markdown only.",
          "Use code fences for non-spoken content such as code or preformatted text.",
        ].join(" "),
      },
      {
        role: "user",
        content: userParts.join("\n\n"),
      },
    ],
    maxTokens: LENGTH,
  });

  const pageMarkdown = normalizeMarkdownText(pageMarkdownResult.markdown);
  if (!pageMarkdown) {
    return "";
  }

  const extracted = await generateStructuredOutput({
    model: "fast",
    schema: extractedArticleSchema,
    messages: [
      {
        role: "system",
        content: [
          "Extract only the main article body from the provided markdown.",
          ...ARTICLE_FIDELITY_RULES,
          "Remove all non-article content, including nav bars, share prompts, related links, newsletter signups, comments, ads, footer/legal boilerplate, and widget text.",
          "Remove only content that is clearly not part of the article body.",
          "Return markdown only.",
          "If no article body exists, return an empty string.",
        ].join(" "),
      },
      {
        role: "user",
        content: pageMarkdown.slice(0, LENGTH),
      },
    ],
    maxTokens: LENGTH,
  });

  return normalizeMarkdownText(extracted.articleMarkdown);
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
          "You are cleaning article markdown, not rewriting it.",
          "Format the article as tidy markdown while preserving the original sentences and paragraph order.",
          ...ARTICLE_FIDELITY_RULES,
          "Remove any leftover non-article noise such as share prompts, related links, or widget text.",
          "Keep existing headings only when they are already present in the article.",
          "Normalize spacing and paragraph breaks for readability.",
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
