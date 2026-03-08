/**
 * Minimal audio feedback for speech dictation using Web Audio API oscillators.
 * No external audio files required.
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
};

type TonePreset = 'start' | 'stop' | 'command';

const TONE_CONFIG: Record<TonePreset, { frequency: number; duration: number; gain: number }> = {
  start:   { frequency: 480, duration: 0.1,  gain: 0.08 },
  stop:    { frequency: 360, duration: 0.12, gain: 0.08 },
  command: { frequency: 560, duration: 0.07, gain: 0.06 },
};

export const playTone = (preset: TonePreset): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const { frequency, duration, gain } = TONE_CONFIG[preset];

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = frequency;

  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};
