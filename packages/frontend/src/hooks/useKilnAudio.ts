import { useRef, useCallback, useEffect } from "react";

function buildKilnSound(ctx: AudioContext): () => void {
  // Pink noise buffer (Paul Kellett's method)
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) / 7;
    b6 = w * 0.115926;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500;
  lowpass.Q.value = 0.4;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.07;

  // Sub-bass rumble oscillator
  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 52;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.03;

  // Slow LFO for breathing effect
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);

  noiseSource.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  rumble.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);
  lfo.start();
  noiseSource.start();
  rumble.start();

  return () => {
    try {
      noiseSource.stop();
      rumble.stop();
      lfo.stop();
    } catch {}
  };
}

export function useKilnAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    stopFnRef.current = buildKilnSound(ctx);
  }, []);

  const stop = useCallback(() => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopFnRef.current?.();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { start, stop };
}
