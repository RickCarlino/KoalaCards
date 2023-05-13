import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useEffect } from "react";

let audioContext: AudioContext;

// Helper function to play audio from an AudioBuffer
const playAudioBuffer = (buffer: AudioBuffer): Promise<void> => {
  return new Promise((resolve) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => resolve();
    source.start(0);
  });
};

export const playAudio = (urlOrDataURI: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      resolve();
    }

    // Create an AudioContext if it doesn't exist yet
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    // Check if the input is a data URI or a URL
    if (urlOrDataURI.startsWith("data:")) {
      // It's a data URI

      // Decode the audio data from the data URI
      const audioData = atob(urlOrDataURI.split(",")[1]);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      // Decode the audio data and play it
      audioContext.decodeAudioData(
        audioArray.buffer,
        (buffer) => {
          playAudioBuffer(buffer).then(resolve);
        },
        (e) => reject(e)
      );
    } else {
      // It's a URL

      // Fetch the audio data from the URL
      fetch(urlOrDataURI)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => playAudioBuffer(audioBuffer).then(resolve))
        .catch((e) => reject(e));
    }
  });
};

/** A React component  */
export function PlayButton({ dataURI }: { dataURI?: string }) {
  if (!dataURI) {
    return (
      <>
        <Button disabled fullWidth>
          ▶️Loading...
        </Button>
      </>
    );
  }
  const playSound = () => playAudio(dataURI);
  useHotkeys([["c", playSound]]);
  useEffect(() => {
    playSound();
  }, [dataURI]);
  return (
    <>
      <Button onClick={playSound} fullWidth>
        ▶️Play Senten[c]e
      </Button>
    </>
  );
}
