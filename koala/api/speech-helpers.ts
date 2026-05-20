export type SpeechFormat = "wav" | "mp3" | "opus";

export function buildSpeechInput(
  targetLanguageText: string,
  englishText: string,
): string | null {
  const cleanTargetLanguageText = targetLanguageText.trim();
  if (!cleanTargetLanguageText) {
    return null;
  }

  const cleanEnglishText = englishText.trim();
  if (cleanEnglishText) {
    return `${cleanTargetLanguageText}\n${cleanEnglishText}`;
  }

  return cleanTargetLanguageText;
}

export function resolveSpeechFormat(
  format: SpeechFormat | undefined,
): SpeechFormat {
  return format ?? "mp3";
}

export function resolveSpeechContentType(format: SpeechFormat): string {
  const contentTypeMap: Record<SpeechFormat, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    opus: "audio/ogg",
  };

  return contentTypeMap[format];
}
