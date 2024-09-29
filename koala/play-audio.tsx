let currentlyPlaying = false;

export const playAudio = (urlOrDataURI: string): void => {
  if (!urlOrDataURI) {
    return;
  }

  if (currentlyPlaying) {
    return;
  }

  currentlyPlaying = true;

  const audio = new Audio(urlOrDataURI);
  audio.onended = () => {
    currentlyPlaying = false;
  };
  audio.onerror = () => {
    currentlyPlaying = false;
  };
  audio.play().catch((e) => {
    currentlyPlaying = false;
    console.error("Audio playback failed:", e);
  });
};
