export type BeepOptions = {
  durationMs?: number;
  frequencyHz?: number;
  volume?: number;
};

export async function playBeep(options: BeepOptions = {}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const { durationMs = 120, frequencyHz = 880, volume = 0.15 } = options;

  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioCtx = win.AudioContext || win.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const ctx = new AudioCtx();
  try {
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    const attack = 0.01;
    const decay = Math.max(0.01, durationMs / 1000 - attack);

    osc.type = "sine";
    osc.frequency.value = frequencyHz;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + attack + decay + 0.02);

    await new Promise<void>((resolve) => {
      osc.onended = () => resolve();
    });
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}
