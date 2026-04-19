import * as React from "react";

type ToneStep = {
  durationMs: number;
  frequenciesHz: number[];
  startMs: number;
  tone?: OscillatorType;
  volume?: number;
};

type ToneLoopPattern = {
  repeatMs: number;
  steps: ToneStep[];
};

const RINGBACK_PATTERN: ToneLoopPattern = {
  repeatMs: 6_000,
  steps: [
    {
      startMs: 0,
      durationMs: 2_000,
      frequenciesHz: [440, 480],
      volume: 0.016,
      tone: "sine",
    },
  ],
};

const INCOMING_RING_PATTERN: ToneLoopPattern = {
  repeatMs: 3_000,
  steps: [
    {
      startMs: 0,
      durationMs: 220,
      frequenciesHz: [392, 523.25],
      volume: 0.03,
      tone: "triangle",
    },
    {
      startMs: 260,
      durationMs: 220,
      frequenciesHz: [392, 523.25],
      volume: 0.03,
      tone: "triangle",
    },
    {
      startMs: 720,
      durationMs: 320,
      frequenciesHz: [440, 587.33],
      volume: 0.03,
      tone: "triangle",
    },
    {
      startMs: 1_080,
      durationMs: 320,
      frequenciesHz: [440, 587.33],
      volume: 0.03,
      tone: "triangle",
    },
  ],
};

const CONNECTED_PATTERN: ToneStep[] = [
  {
    startMs: 0,
    durationMs: 120,
    frequenciesHz: [659.25],
    volume: 0.028,
    tone: "sine",
  },
  {
    startMs: 130,
    durationMs: 170,
    frequenciesHz: [880],
    volume: 0.03,
    tone: "sine",
  },
];

const HANGUP_PATTERN: ToneStep[] = [
  {
    startMs: 0,
    durationMs: 110,
    frequenciesHz: [659.25],
    volume: 0.026,
    tone: "triangle",
  },
  {
    startMs: 120,
    durationMs: 200,
    frequenciesHz: [392],
    volume: 0.026,
    tone: "triangle",
  },
];

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const win = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };

  return win.AudioContext || win.webkitAudioContext;
}

function stopOscillatorSafely(oscillator: OscillatorNode): void {
  try {
    oscillator.stop();
  } catch {
    return;
  }
}

function schedulePattern(
  audioContext: AudioContext,
  oscillators: Set<OscillatorNode>,
  steps: ToneStep[],
): void {
  const patternStartedAt = audioContext.currentTime;

  steps.forEach((step) => {
    const startedAt = patternStartedAt + step.startMs / 1000;
    const endsAt = startedAt + step.durationMs / 1000;
    const attackEndsAt = startedAt + 0.01;
    const releaseStartsAt = Math.max(attackEndsAt, endsAt - 0.04);

    step.frequenciesHz.forEach((frequencyHz) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = step.tone ?? "sine";
      oscillator.frequency.value = frequencyHz;

      gain.gain.setValueAtTime(0.0001, startedAt);
      gain.gain.linearRampToValueAtTime(step.volume ?? 0.02, attackEndsAt);
      gain.gain.setValueAtTime(step.volume ?? 0.02, releaseStartsAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillators.add(oscillator);
      oscillator.onended = () => {
        oscillators.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };

      oscillator.start(startedAt);
      oscillator.stop(endsAt + 0.02);
    });
  });
}

export function useLanguageExchangeSounds() {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const loopingOscillatorsRef = React.useRef<Set<OscillatorNode>>(
    new Set(),
  );
  const oneShotOscillatorsRef = React.useRef<Set<OscillatorNode>>(
    new Set(),
  );
  const loopIntervalIdRef = React.useRef<number | null>(null);

  const stopLoopingSound = React.useCallback(() => {
    if (loopIntervalIdRef.current !== null) {
      window.clearInterval(loopIntervalIdRef.current);
      loopIntervalIdRef.current = null;
    }

    loopingOscillatorsRef.current.forEach((oscillator) => {
      stopOscillatorSafely(oscillator);
    });
    loopingOscillatorsRef.current.clear();
  }, []);

  const stopAllSounds = React.useCallback(() => {
    stopLoopingSound();
    oneShotOscillatorsRef.current.forEach((oscillator) => {
      stopOscillatorSafely(oscillator);
    });
    oneShotOscillatorsRef.current.clear();
  }, [stopLoopingSound]);

  const ensureAudioContext = React.useCallback(async () => {
    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const audioContext = audioContextRef.current;
    if (audioContext.state === "suspended") {
      await audioContext.resume().catch(() => undefined);
    }

    if (audioContext.state === "closed") {
      audioContextRef.current = null;
      return null;
    }

    return audioContext;
  }, []);

  const startLoop = React.useCallback(
    async (pattern: ToneLoopPattern) => {
      stopLoopingSound();

      const audioContext = await ensureAudioContext();
      if (!audioContext || audioContext.state !== "running") {
        return;
      }

      const schedule = () => {
        schedulePattern(
          audioContext,
          loopingOscillatorsRef.current,
          pattern.steps,
        );
      };

      schedule();
      loopIntervalIdRef.current = window.setInterval(
        schedule,
        pattern.repeatMs,
      );
    },
    [ensureAudioContext, stopLoopingSound],
  );

  const playOnce = React.useCallback(
    async (steps: ToneStep[]) => {
      const audioContext = await ensureAudioContext();
      if (!audioContext || audioContext.state !== "running") {
        return;
      }

      schedulePattern(audioContext, oneShotOscillatorsRef.current, steps);
    },
    [ensureAudioContext],
  );

  React.useEffect(() => {
    const unlockAudio = () => {
      void ensureAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [ensureAudioContext]);

  React.useEffect(() => {
    return () => {
      stopAllSounds();

      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (!audioContext || audioContext.state === "closed") {
        return;
      }

      void audioContext.close().catch(() => undefined);
    };
  }, [stopAllSounds]);

  const playConnectedTone = React.useCallback(() => {
    return playOnce(CONNECTED_PATTERN);
  }, [playOnce]);

  const playHangupTone = React.useCallback(() => {
    return playOnce(HANGUP_PATTERN);
  }, [playOnce]);

  const startIncomingRingtone = React.useCallback(() => {
    return startLoop(INCOMING_RING_PATTERN);
  }, [startLoop]);

  const startRingbackTone = React.useCallback(() => {
    return startLoop(RINGBACK_PATTERN);
  }, [startLoop]);

  return React.useMemo(() => {
    return {
      playConnectedTone,
      playHangupTone,
      startIncomingRingtone,
      startRingbackTone,
      stopLoopingSound,
      stopSounds: stopAllSounds,
    };
  }, [
    playConnectedTone,
    playHangupTone,
    startIncomingRingtone,
    startRingbackTone,
    stopAllSounds,
    stopLoopingSound,
  ]);
}
