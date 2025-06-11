let lastAudio: string;
export const playAudio = (urlOrDataURI: string) => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      reject(new Error("No audio source provided."));
      return;
    }
    let done = false;
    console.log("Playing audio: ", urlOrDataURI.slice(0, 65));
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

    audio.onerror = (e) => {
      console.error("Audio playback failed:", e);
      reject(e);
    };

    audio.play().catch((e) => {
      console.error("Audio playback failed:", e);
      reject(e);
    });
  });
};
