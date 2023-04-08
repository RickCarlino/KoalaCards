// Please see this URL for more information:
// https://github.com/gillesdemey/node-record-lpcm16/issues/66
import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { play } from "./play";
const DEFAULT_OPTS = {
  audioType: "wav",
  channels: 1,
  compress: false,
  endOnSilence: false,
  recorder: "sox",
  recordProgram: "rec",
  sampleRate: 16000,
  sampleRateHertz: 16000,
  silence: "1.50",
  threshold: 0,
  thresholdEnd: null,
  thresholdStart: null,
};

type RecorderOpts = typeof DEFAULT_OPTS;

const defaultRecorder = (options: Partial<RecorderOpts> = {}) => {
  const cmd = "rec";

  let args = [
    "-q", // show no progress
    "-r",
    options.sampleRate ?? "", // sample rate
    "-c",
    options.channels ?? "", // channels
    "-e",
    "signed-integer", // sample encoding
    "-b",
    "16", // precision (bits)
    "-t",
    options.audioType ?? "", // audio type
    "-", // pipe
  ];

  if (options.endOnSilence) {
    args = args.concat([
      "silence",
      "1",
      "0.1",
      options.thresholdStart || options.threshold + "%",
      "1",
      options.silence ?? "",
      options.thresholdEnd || options.threshold + "%",
    ]);
  }
  return { cmd, args, spawnOptions: {} };
};

class Recording {
  public options = DEFAULT_OPTS;
  public cmd: string;
  public args: (string | number)[];
  public cmdOptions: {};
  public process?: ChildProcessWithoutNullStreams;
  public _stream?: NodeJS.ReadableStream;

  constructor(options: Partial<typeof DEFAULT_OPTS> = {}) {
    this.options = Object.assign(DEFAULT_OPTS, options);

    const recorder = defaultRecorder;
    const { cmd, args, spawnOptions = {} } = recorder(this.options);

    this.cmd = cmd;
    this.args = args;
    this.cmdOptions = Object.assign(
      { encoding: "binary", stdio: "pipe" },
      spawnOptions
    );

    return this.start();
  }

  start() {
    let ready = false;
    const { cmd, args, cmdOptions } = this;

    const cp = spawn(
      cmd,
      args.map((x) => "" + x),
      cmdOptions
    );
    const rec = cp.stdout;
    const err = cp.stderr;

    this.process = cp; // expose child process
    this._stream = rec; // expose output stream

    cp.on("close", (code) => {
      if (code === 0) return;
      const err = `${this.cmd} has exited with error code ${code}.`;
      console.error(err);
      rec.emit("error", err);
    });

    rec.on("data", (chunk) => {
      if (!ready) {
        ready = true;
        play("sfx/flip.wav");
      }
    });

    rec.on("end", () => {
      play("sfx/tap.aif");
    });

    return this;
  }

  stop() {
    assert(this.process, "Recording not yet started");

    this.process.kill();
  }

  pause() {
    assert(this.process, "Recording not yet started");

    this.process.kill("SIGSTOP");
    this._stream?.pause();
  }

  resume() {
    assert(this.process, "Recording not yet started");

    this.process.kill("SIGCONT");
    this._stream?.resume();
  }

  isPaused() {
    assert(this.process, "Recording not yet started");

    return this._stream?.isPaused();
  }

  stream() {
    assert(this._stream, "Recording not yet started");

    return this._stream;
  }
}

export const record = (x: Partial<typeof DEFAULT_OPTS>) => new Recording(x);
