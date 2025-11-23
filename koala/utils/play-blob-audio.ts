export const playBlob = (
  blob: Blob,
  playbackRate?: number,
): Promise<void> => {
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
      cleanup();
      resolve();
    };
    void audio.play();
  });
};

let _currentAudio: HTMLAudioElement | null = null;
let _currentUrl: string | null = null;

export const playBlobExclusive = (
  blob: Blob,
  playbackRate?: number,
): Promise<void> => {
  if (_currentAudio) {
    _currentAudio?.pause();
  }
  if (_currentUrl) {
    URL.revokeObjectURL(_currentUrl);
    _currentUrl = null;
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  _currentAudio = audio;
  _currentUrl = url;
  if (typeof playbackRate === "number" && Number.isFinite(playbackRate)) {
    audio.playbackRate = playbackRate;
  }

  const cleanup = () => {
    audio.pause();
    if (_currentUrl) {
      URL.revokeObjectURL(_currentUrl);
    }
    if (_currentAudio === audio) {
      _currentAudio = null;
      _currentUrl = null;
    }
  };

  return new Promise((resolve) => {
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      resolve();
    };
    void audio.play();
  });
};
