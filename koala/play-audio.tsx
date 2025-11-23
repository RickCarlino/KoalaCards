let lastAudio: string | undefined;
let playbackQueue: Promise<void> = Promise.resolve();

const playSingleAudio = (
  urlOrDataURI: string,
  playbackRate?: number,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let done = false;
    const audio = new Audio(urlOrDataURI);
    const hasValidRate =
      typeof playbackRate === "number" &&
      Number.isFinite(playbackRate) &&
      playbackRate > 0;

    if (hasValidRate) {
      audio.playbackRate = playbackRate;
    }
    if (!hasValidRate && lastAudio === urlOrDataURI) {
      audio.playbackRate = 0.6;
    }

    const fail = (error: unknown) => {
      if (done) {
        return;
      }
      done = true;
      audio.pause();
      reject(error);
    };

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      audio.pause();
      resolve();
    };

    audio.onended = finish;
    audio.onerror = fail;
    lastAudio = urlOrDataURI;

    audio.play().catch(fail);
  });
};

export const playAudio = (
  urlOrDataURI: string,
  playbackRate?: number,
): Promise<void> => {
  if (!urlOrDataURI) {
    return Promise.reject(new Error("No audio source provided."));
  }

  playbackQueue = playbackQueue
    .catch(() => undefined)
    .then(() => playSingleAudio(urlOrDataURI, playbackRate));

  return playbackQueue;
};
