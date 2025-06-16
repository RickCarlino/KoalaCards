/**
 * Converts an MP4 audio Blob to a single-channel (mono) WAV audio Blob.
 *
 * This function takes an MP4 audio Blob as input, decodes it, downmixes it to mono,
 * and converts it to a WAV audio Blob. This is useful when the target use case requires
 * single-channel audio, such as voice recordings or other mono audio data.
 *
 * Example usage:
 * // Convert an MP4 audio Blob to a single-channel WAV audio Blob
 * const mp4Blob = new Blob([data], { type: "audio/mp4" });
 * const wavBlob = await convertBlobToWav(mp4Blob);
 *
 * // Use the resulting WAV Blob, e.g., for playback or upload
 * const audioURL = URL.createObjectURL(wavBlob);
 * const audioElement = new Audio(audioURL);
 * audioElement.play();
 */
export async function convertBlobToWav(
  blob: Blob,
  targetSampleRate = 16000,
): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    // Firefox iOS may produce audio that can't be decoded directly
    // Try creating a new blob with explicit MIME type
    console.error("Initial decode failed, attempting workaround:", error);

    // Check if this is already WAV format
    const uint8Array = new Uint8Array(arrayBuffer);
    const isWav =
      uint8Array.length > 4 &&
      uint8Array[0] === 0x52 && // 'R'
      uint8Array[1] === 0x49 && // 'I'
      uint8Array[2] === 0x46 && // 'F'
      uint8Array[3] === 0x46; // 'F'

    if (isWav) {
      // Already WAV, just return as-is
      return blob;
    }

    // Re-throw if we can't handle it
    throw error;
  }
  const numberOfChannels = 1; // Set to mono

  // Create an offline audio context to resample the audio
  const offlineAudioContext = new OfflineAudioContext(
    numberOfChannels,
    audioBuffer.duration * targetSampleRate,
    targetSampleRate,
  );

  // Create a buffer source with the original audio
  const bufferSource = offlineAudioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  // Connect the buffer source to the offline audio context
  bufferSource.connect(offlineAudioContext.destination);

  // Start the buffer source
  bufferSource.start(0);

  // Render the resampled audio
  const resampledBuffer = await offlineAudioContext.startRendering();
  const sampleRate = resampledBuffer.sampleRate;

  const wavBuffer = new ArrayBuffer(44 + resampledBuffer.length * 2);
  const view = new DataView(wavBuffer);

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 32 + resampledBuffer.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, resampledBuffer.length * 2, true);

  const length = resampledBuffer.length;
  const volume = 1;
  let index = 44;

  for (let i = 0; i < length; i++) {
    let mixedSample = 0;
    for (
      let channel = 0;
      channel < resampledBuffer.numberOfChannels;
      channel++
    ) {
      mixedSample += resampledBuffer.getChannelData(channel)[i];
    }
    mixedSample /= resampledBuffer.numberOfChannels;
    view.setInt16(index, mixedSample * (0x7fff * volume), true);
    index += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
