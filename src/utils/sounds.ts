import { Platform } from 'react-native';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Unlocks/resumes the shared Web Audio context inside a direct user gesture
 * (required on iOS Safari so delayed countdown ticks at 3, 2, 1, 0 play aloud).
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Ignore audio unlock errors
  }
}

interface ToneOptions {
  freq: number;
  startOffsetSec?: number;
  durationSec: number;
  gain?: number;
  type?: OscillatorType;
}

function playTone({
  freq,
  startOffsetSec = 0,
  durationSec,
  gain = 0.16,
  type = 'sine',
}: ToneOptions): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const t0 = ctx.currentTime + startOffsetSec;
    const tEnd = t0 + durationSec;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    // Smooth click-free envelope
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    osc.connect(env);
    env.connect(ctx.destination);

    osc.start(t0);
    osc.stop(tEnd + 0.02);
  } catch {
    // Ignore audio synthesis errors
  }
}

/** Crisp two-note ascending chime when starting/resuming the rest timer. */
export function playTimerStartSound(): void {
  unlockAudio();
  playTone({ freq: 587.33, startOffsetSec: 0, durationSec: 0.09, gain: 0.15, type: 'triangle' });
  playTone({ freq: 880, startOffsetSec: 0.085, durationSec: 0.14, gain: 0.18, type: 'triangle' });
}

/** Short escalating tick beep for the last 3 seconds of the timer (3, 2, 1). */
export function playCountdownBeep(secondsLeft: number): void {
  const freq = secondsLeft <= 1 ? 880 : secondsLeft === 2 ? 740 : 660;
  playTone({
    freq,
    startOffsetSec: 0,
    durationSec: secondsLeft <= 1 ? 0.13 : 0.095,
    gain: 0.2,
    type: 'sine',
  });
}

/** Bright three-note completion bell when the timer finishes at 00:00. */
export function playTimerFinishSound(): void {
  playTone({ freq: 880, startOffsetSec: 0, durationSec: 0.12, gain: 0.2, type: 'triangle' });
  playTone({ freq: 1046.5, startOffsetSec: 0.11, durationSec: 0.12, gain: 0.22, type: 'triangle' });
  playTone({ freq: 1318.5, startOffsetSec: 0.22, durationSec: 0.28, gain: 0.24, type: 'triangle' });
}
