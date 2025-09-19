let lastAudio: string;
export const playAudio = (urlOrDataURI: string, playbackRate?: number) => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      reject(new Error("No audio source provided."));
      return;
    }
    let done = false;

    const audio = new Audio(urlOrDataURI);

    // Apply playback rate if provided and valid; otherwise, keep legacy
    // behavior of slowing repeated taps to 0.6x.
    const hasValidRate =
      typeof playbackRate === "number" &&
      Number.isFinite(playbackRate) &&
      playbackRate > 0;
    if (hasValidRate) {
      audio.playbackRate = playbackRate as number;
    }
    if (!hasValidRate && lastAudio === urlOrDataURI) {
      audio.playbackRate = 0.6;
    }

    const ok = () => {
      if (done) {
        return;
      }
      done = true;
      // Stop audio from playing:
      audio.pause();
      resolve("");
    };
    lastAudio = urlOrDataURI;

    audio.onended = ok;

    audio.onerror = (e) => {
      reject(e);
    };

    audio.play().catch((e) => {
      reject(e);
    });
  });
};
