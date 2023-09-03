import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useEffect } from "react";

let audioContext: AudioContext;
// let audioQueue: string[] = [];
let currentlyPlaying = false;

const playAudioBuffer = (buffer: AudioBuffer): Promise<void> => {
  return new Promise((resolve) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      currentlyPlaying = false;
      resolve();
    };
    source.start(0);
  });
};

export const playAudio = (urlOrDataURI: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!urlOrDataURI) {
      resolve();
    }

    if (currentlyPlaying) {
      return;
    }

    currentlyPlaying = true;

    if (!audioContext) {
      audioContext = new AudioContext();
    }

    if (urlOrDataURI.startsWith("data:")) {
      const audioData = atob(urlOrDataURI.split(",")[1]);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      audioContext.decodeAudioData(
        audioArray.buffer,
        (buffer) => {
          playAudioBuffer(buffer).then(resolve);
        },
        (e) => reject(e),
      );
    } else {
      fetch(urlOrDataURI)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => playAudioBuffer(audioBuffer).then(resolve))
        .catch((e) => reject(e));
    }
  });
};

/** A React component  */
export function PlayButton({ dataURI }: { dataURI: string }) {
  const playSound = () => {
    if (dataURI) {
      playAudio(dataURI);
    }
  };
  useHotkeys([["c", playSound]]);

  // Use the useEffect hook to listen for changes to dataURI
  useEffect(() => {
    if (dataURI) {
      playAudio(dataURI);
    }
  }, [dataURI]);  // Dependency array includes dataURI

  if (!dataURI) {
    return (
      <>
        <Button disabled fullWidth>
          ▶️Loading...
        </Button>
      </>
    );
  }

  return (
    <>
      <Button onClick={playSound} fullWidth>
        [C]▶️Play Sentence
      </Button>
    </>
  );
}
