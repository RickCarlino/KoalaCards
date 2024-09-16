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

export const playAudio = async (urlOrDataURI: string): Promise<void> => {
  if (!urlOrDataURI) {
    return;
  }

  if (currentlyPlaying) {
    return;
  }

  currentlyPlaying = true;
  const audioContext = new AudioContext();

  try {
    let arrayBuffer: ArrayBuffer;

    if (urlOrDataURI.startsWith("data:")) {
      // Handle Base64 Data URI
      const base64Data = urlOrDataURI.split(",")[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      // Handle external URL
      const response = await fetch(urlOrDataURI);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      arrayBuffer = await response.arrayBuffer();
    }

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await playAudioBuffer(audioBuffer, audioContext);
  } catch (e) {
    currentlyPlaying = false;
    throw e;
  }
};
