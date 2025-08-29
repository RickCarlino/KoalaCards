export const playBlob = (blob: Blob, playbackRate?: number): Promise<void> => {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  if (typeof playbackRate === "number" && Number.isFinite(playbackRate)) {
    audio.playbackRate = playbackRate;
  }

  const cleanup = () => {
    audio.pause();
    URL.revokeObjectURL(url);
  };

  return new Promise((resolve) => {
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      // Treat playback errors as non-fatal; still resolve to continue flow
      cleanup();
      resolve();
    };
    void audio.play();
  });
};
