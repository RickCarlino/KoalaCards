import speech from "@google-cloud/speech";
import { record } from "./record";
import { createWriteStream } from "fs";

interface SpeechAlternative {
  words: any[];
  transcript: string;
  confidence: number;
}
interface SpeechData {
  alternatives: SpeechAlternative[];
  isFinal: boolean;
  stability: number;
  resultEndTime: { seconds: string; nanos: number };
  channelTag: number;
  languageCode: string;
}

const client = new speech.SpeechClient();

interface SpeechInputOptions {
  lang: string;
  sampleRate: number;
  silence: number;
}

interface SpeechTranscription {
  transcript: string;
  confidence: number;
}

const DEFAULTS: SpeechInputOptions = {
  lang: "ko",
  sampleRate: 16000,
  silence: 1.5,
};

export function transcribeSpeech(
  opts: Partial<SpeechInputOptions> = {}
): Promise<SpeechTranscription> {
  return new Promise((res, rej) => {
    const sampleRateHertz = opts.sampleRate ?? DEFAULTS.sampleRate;
    const languageCode = opts.lang ?? DEFAULTS.lang;
    const mic = record({
      sampleRate: sampleRateHertz,
      threshold: 0, //silence threshold
      silence: (opts.silence ?? DEFAULTS.silence).toFixed(2),
      endOnSilence: true,
    });

    const recognizeStream = client
      .streamingRecognize({
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: sampleRateHertz,
          languageCode: languageCode,
          // maxAlternatives: 3,
        },
        interimResults: false, //Get interim results from stream
      })
      .on("data", (data: { results: SpeechData[] }) => {
        const result = data?.results[0]?.alternatives[0];
        if (result) {
          res({
            transcript: result.transcript,
            confidence: result.confidence,
          });
        }
        mic.stop();
      })
      .on("error", rej);
    const stream2 = mic.stream().on("error", rej);
    stream2.pipe(recognizeStream);
    // Use this for playback.
    stream2.pipe(createWriteStream("/tmp/last-recording.wav"));
  });
}
