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

export function buildTranscriptionPrompt(hint: string): string | null {
  if (!hint) {
    return null;
  }
  return `Might contain words like ${hint}`;
}

export function buildTranscriptionRequest<TFile>(options: {
  file: TFile;
  language: string;
  prompt: string | null;
}) {
  return {
    file: options.file,
    model: "gpt-4o-mini-transcribe" as const,
    language: options.language,
    ...(options.prompt ? { prompt: options.prompt } : {}),
  };
}
