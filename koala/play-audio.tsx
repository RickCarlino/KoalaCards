let lastAudio: string;
export const playAudio = (urlOrDataURI: string) => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      reject(new Error("No audio source provided."));
      return;
    }
    let done = false;

    const audio = new Audio(urlOrDataURI);

    const ok = () => {
      if (done) return;
      done = true;
      // Stop audio from playing:
      audio.pause();
      resolve("");
    };
    if (lastAudio === urlOrDataURI) {
      audio.playbackRate = 0.6;
    }
    lastAudio = urlOrDataURI;

    audio.onended = ok;
    // Resolve after N seconds because sometimes OpenAI TTS has tons of dead air:
    setTimeout(() => ok(), 8000);
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
