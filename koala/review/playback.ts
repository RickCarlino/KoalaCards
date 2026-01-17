import { playAudio, resetPlaybackQueue } from "@/koala/play-audio";
import { Quiz } from "./types";

type SpeechRequestBody = {
  tl: string;
  format: "mp3";
};

const SPEECH_FORMAT: SpeechRequestBody["format"] = "mp3";

export const playTermThenDefinition = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  playbackSpeed?: number,
  queueId?: number,
) => {
  const activeQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();
  const sources = [card.termAudio, card.definitionAudio];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    await playAudio(source, playbackSpeed, activeQueueId);
  }
};

const requestSpeechBlob = async (text: string): Promise<Blob> => {
  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tl: text,
      format: SPEECH_FORMAT,
    } satisfies SpeechRequestBody),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Speech request failed (${response.status})`,
    );
  }

  return await response.blob();
};

export const playSpeechText = async (
  text: string,
  playbackSpeed?: number,
  queueId?: number,
): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const blob = await requestSpeechBlob(trimmed);
  const url = URL.createObjectURL(blob);
  const activeQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();

  try {
    await playAudio(url, playbackSpeed, activeQueueId);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const playTermThenDefinitionWithFeedback = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  feedbackText: string,
  playbackSpeed?: number,
): Promise<void> => {
  const queueId = resetPlaybackQueue();
  await playTermThenDefinition(card, playbackSpeed, queueId);
  await playSpeechText(feedbackText, playbackSpeed, queueId);
};
