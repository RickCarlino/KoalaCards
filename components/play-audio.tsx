let currentlyPlaying = false;

const playAudioBuffer = (
  buffer: AudioBuffer,
  context: AudioContext,
): Promise<void> => {
  return new Promise((resolve) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      currentlyPlaying = false;
      resolve();
    };
    source.start(0);
  });
};

export const playAudio = (urlOrDataURI: string): Promise<void> => {
  const audioContext = new AudioContext();
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      return resolve();
    }

    if (currentlyPlaying) {
      return resolve();
    }

    currentlyPlaying = true;

    const audioData = atob(urlOrDataURI.split(",")[1]);
    const audioArray = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      audioArray[i] = audioData.charCodeAt(i);
    }

    audioContext.decodeAudioData(
      audioArray.buffer,
      (buffer) => {
        playAudioBuffer(buffer, audioContext).then(resolve);
      },
      (e) => reject(e),
    );
  });
};
