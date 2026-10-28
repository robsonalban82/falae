/** Short original feedback sounds synthesized with Web Audio (ADR-003). */

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const SOUNDS: Record<'correct' | 'wrong' | 'complete' | 'combo', Note[]> = {
  correct: [
    { freq: 660, at: 0, dur: 0.09 },
    { freq: 990, at: 0.08, dur: 0.14 },
  ],
  wrong: [
    { freq: 220, at: 0, dur: 0.12, type: 'triangle' },
    { freq: 174, at: 0.1, dur: 0.18, type: 'triangle' },
  ],
  complete: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 659, at: 0.11, dur: 0.12 },
    { freq: 784, at: 0.22, dur: 0.12 },
    { freq: 1046, at: 0.33, dur: 0.3 },
  ],
  combo: [
    { freq: 880, at: 0, dur: 0.06 },
    { freq: 1175, at: 0.05, dur: 0.06 },
    { freq: 1568, at: 0.1, dur: 0.12 },
  ],
};

export type SoundName = keyof typeof SOUNDS;

let ctx: AudioContext | null = null;

export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window)) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.freq;
      const peak = n.gain ?? 0.18;
      gain.gain.setValueAtTime(0.0001, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
  } catch {
    // Audio is a nice-to-have; never break the lesson over it.
  }
}
