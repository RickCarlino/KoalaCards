import { playAudio, resetPlaybackQueue } from "@/koala/play-audio";
import { Quiz } from "./types";

export const playTermThenDefinition = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  playbackSpeed?: number,
) => {
  const queueId = resetPlaybackQueue();
  const sources = [card.termAudio, card.definitionAudio];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    await playAudio(source, playbackSpeed, queueId);
  }
};
