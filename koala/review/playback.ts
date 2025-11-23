import { playAudio } from "@/koala/play-audio";
import { Quiz } from "./types";

export const playTermThenDefinition = async (
  card: Pick<Quiz, "termAudio" | "definitionAudio">,
  playbackSpeed?: number,
) => {
  const sources = [card.termAudio, card.definitionAudio];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    await playAudio(source, playbackSpeed);
  }
};
