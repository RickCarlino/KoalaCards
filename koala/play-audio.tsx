type PlaybackQueue = {
  id: number;
  tail: Promise<void>;
  controller: AbortController;
};

let lastAudio: string | undefined;
let currentAudio: HTMLAudioElement | null = null;
let playbackQueue: PlaybackQueue = {
  id: 0,
  tail: Promise.resolve(),
  controller: new AbortController(),
};

const stopCurrentAudio = () => {
  if (!currentAudio) {
    return;
  }
  currentAudio.pause();
  currentAudio.src = "";
  currentAudio.load();
  currentAudio = null;
};

export const resetPlaybackQueue = (): number => {
  playbackQueue.controller.abort();
  stopCurrentAudio();
  playbackQueue = {
    id: playbackQueue.id + 1,
    tail: Promise.resolve(),
    controller: new AbortController(),
  };
  return playbackQueue.id;
};

const playSingleAudio = (
  urlOrDataURI: string,
  playbackRate: number | undefined,
  queueId: number,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (queueId !== playbackQueue.id) {
      resolve();
      return;
    }

    let done = false;
    const { controller } = playbackQueue;
    const audio = new Audio(urlOrDataURI);
    currentAudio = audio;
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

    const cleanup = () => {
      if (currentAudio === audio) {
        stopCurrentAudio();
      }
      controller.signal.removeEventListener("abort", handleAbort);
    };

    const fail = (error: unknown) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(error);
    };

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve();
    };

    const handleAbort = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve();
    };

    controller.signal.addEventListener("abort", handleAbort, {
      once: true,
    });

    audio.onended = finish;
    audio.onerror = fail;
    lastAudio = urlOrDataURI;

    audio.play().catch(fail);
  });
};

export const playAudio = (
  urlOrDataURI: string,
  playbackRate?: number,
  queueId?: number,
): Promise<void> => {
  if (!urlOrDataURI) {
    return Promise.reject(new Error("No audio source provided."));
  }

  const targetQueueId =
    typeof queueId === "number" ? queueId : resetPlaybackQueue();

  if (targetQueueId !== playbackQueue.id) {
    return Promise.resolve();
  }

  playbackQueue.tail = playbackQueue.tail
    .catch(() => undefined)
    .then(() =>
      playSingleAudio(urlOrDataURI, playbackRate, targetQueueId),
    );

  return playbackQueue.tail;
};
