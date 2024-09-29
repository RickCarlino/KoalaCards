let currentlyPlaying = false;

export const playAudio = (urlOrDataURI: string) => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      return;
    }

    if (currentlyPlaying) {
      return;
    }

    currentlyPlaying = true;

    const ok = () => {
      currentlyPlaying = false;
      resolve("");
    };

    const audio = new Audio(urlOrDataURI);
    audio.onended = ok;
    audio.onerror = ok;
    audio.play().catch((e) => {
      reject(e);
      console.error("Audio playback failed:", e);
    });
  });
};
