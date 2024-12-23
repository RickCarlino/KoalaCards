let lastAudio: string;
export const playAudio = (urlOrDataURI: string) => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      reject(new Error("No audio source provided."));
      return;
    }

    const ok = () => {
      resolve("");
    };

    const audio = new Audio(urlOrDataURI);
    if (lastAudio === urlOrDataURI) {
      audio.playbackRate = 0.6;
    }
    lastAudio = urlOrDataURI;
    audio.onended = ok;
    audio.onerror = (e) => {
      reject(e);
      console.error("Audio playback failed:", e);
    };

    audio.play().catch((e) => {
      reject(e);
      console.error("Audio playback failed:", e);
    });
  });
};
