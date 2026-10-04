import { OPENAI_TRANSCRIPTION_MODEL } from "../ai-openai-config";

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveContentType(
  contentTypeHeader: string | string[] | undefined,
): string {
  return firstParam(contentTypeHeader) ?? "application/octet-stream";
}

export function hasValidAudioContentLength(
  contentLength: number,
  maxBytes: number,
): boolean {
  if (!Number.isFinite(contentLength)) {
    return true;
  }
  return contentLength <= maxBytes;
}

export function getAudioFilename(contentType: string): string {
  if (/mp4|mpeg/.test(contentType)) {
    return "recording.mp4";
  }
  return "recording.webm";
}

const KOREAN_TRANSCRIPTION_PROMPT =
  "한국어 음성을 한글로 받아쓰세요. 로마자나 일본어 문자로 바꾸지 마세요.";

export function buildTranscriptionPrompt(hint: string): string | null {
  if (!hint) {
    return null;
  }
  return `Might contain words like ${hint}`;
}

export function buildKoreanTranscriptionPrompt(
  hintPrompt: string | null,
): string {
  if (!hintPrompt) {
    return KOREAN_TRANSCRIPTION_PROMPT;
  }
  return `${KOREAN_TRANSCRIPTION_PROMPT}\n${hintPrompt}`;
}

export function buildTranscriptionRequest<TFile>(options: {
  file: TFile;
  language: string;
  prompt: string | null;
}) {
  return {
    file: options.file,
    model: OPENAI_TRANSCRIPTION_MODEL,
    language: options.language,
    response_format: "json" as const,
    ...(options.prompt ? { prompt: options.prompt } : {}),
  };
}
