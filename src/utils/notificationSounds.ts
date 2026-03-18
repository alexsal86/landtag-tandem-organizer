import { debugConsole } from '@/utils/debugConsole';

export const NOTIFICATION_SOUNDS = [
  { value: 'ping', label: 'Ping' },
  { value: 'bell', label: 'Glocke' },
  { value: 'pop', label: 'Plopp' },
  { value: 'subtle', label: 'Dezent' },
  { value: 'chime', label: 'Klang' },
  { value: 'melody', label: 'Melodie' },
  { value: 'harp', label: 'Harfe' },
  { value: 'alert', label: 'Alarm' },
  { value: 'custom', label: 'Eigener Ton' },
] as const;

export type SoundName = (typeof NOTIFICATION_SOUNDS)[number]['value'];

type SoundOption = (typeof NOTIFICATION_SOUNDS)[number];

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function createTone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  startTime: number,
  duration: number,
  gainValue = 0.5,
  decayTime?: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
  const decay = decayTime ?? duration * 0.7;
  env.gain.setValueAtTime(gainValue, startTime + duration - decay);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playNotificationSound(soundName: SoundName, volume = 0.5): void {
  if (soundName === 'custom') {
    playCustomSound(volume);
    return;
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
    gainNode.connect(ctx.destination);

    switch (soundName) {
      case 'ping':
        playPing(ctx, gainNode);
        break;
      case 'bell':
        playBell(ctx, gainNode);
        break;
      case 'pop':
        playPop(ctx, gainNode);
        break;
      case 'subtle':
        playSubtle(ctx, gainNode);
        break;
      case 'chime':
        playChime(ctx, gainNode);
        break;
      case 'melody':
        playMelody(ctx, gainNode);
        break;
      case 'harp':
        playHarp(ctx, gainNode);
        break;
      case 'alert':
        playAlert(ctx, gainNode);
        break;
      default:
        playPing(ctx, gainNode);
    }
  } catch (error: unknown) {
    debugConsole.error('Error playing notification sound:', error);
  }
}

function playCustomSound(volume: number): void {
  const dataUrl = localStorage.getItem('custom_notification_sound');
  if (!dataUrl) {
    return;
  }

  const audio = new Audio(dataUrl);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch((error: unknown) => {
    debugConsole.error('Error playing custom notification sound:', error);
  });
}

export function hasCustomSound(): boolean {
  return localStorage.getItem('custom_notification_sound') != null;
}

export function saveCustomSound(dataUrl: string): void {
  localStorage.setItem('custom_notification_sound', dataUrl);
}

export function removeCustomSound(): void {
  localStorage.removeItem('custom_notification_sound');
}

export function getNotificationSoundOptions(): readonly SoundOption[] {
  return NOTIFICATION_SOUNDS;
}

function playPing(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  createTone(ctx, gain, 'sine', 880, t, 0.2, 0.6, 0.15);
  createTone(ctx, gain, 'sine', 1174, t + 0.15, 0.35, 0.5, 0.25);
}

function playBell(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  const fundamentals = [800, 1600, 2400, 3200];
  const gains = [0.5, 0.3, 0.15, 0.08];
  const durations = [0.8, 0.6, 0.4, 0.3];

  fundamentals.forEach((freq: number, index: number): void => {
    createTone(ctx, gain, 'sine', freq, t, durations[index], gains[index], durations[index] * 0.8);
  });
}

function playPop(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.7, t + 0.01);
  env.gain.setValueAtTime(0.7, t + 0.06);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

  osc.connect(env);
  env.connect(gain);
  osc.start(t);
  osc.stop(t + 0.45);
}

function playSubtle(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  createTone(ctx, gain, 'triangle', 659, t, 0.25, 0.3, 0.2);
  createTone(ctx, gain, 'triangle', 784, t + 0.25, 0.35, 0.25, 0.3);
}

function playChime(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  const notes = [523, 659, 784];
  notes.forEach((freq: number, index: number): void => {
    const start = t + index * 0.12;
    createTone(ctx, gain, 'sine', freq, start, 0.5, 0.45, 0.4);
    createTone(ctx, gain, 'sine', freq * 2, start, 0.3, 0.12, 0.25);
  });
}

function playMelody(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  const notes: Array<{ freq: number; dur: number }> = [
    { freq: 523, dur: 0.2 },
    { freq: 659, dur: 0.2 },
    { freq: 784, dur: 0.2 },
    { freq: 1047, dur: 0.5 },
  ];

  let offset = 0;
  notes.forEach(({ freq, dur }): void => {
    createTone(ctx, gain, 'sine', freq, t + offset, dur, 0.4, dur * 0.6);
    createTone(ctx, gain, 'triangle', freq, t + offset, dur * 0.8, 0.1, dur * 0.5);
    offset += dur * 0.85;
  });
}

function playHarp(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  const notes = [392, 494, 587, 740, 988];
  notes.forEach((freq: number, index: number): void => {
    const start = t + index * 0.08;
    createTone(ctx, gain, 'triangle', freq, start, 0.6, 0.35 - index * 0.03, 0.5);
    createTone(ctx, gain, 'sine', freq * 1.002, start, 0.5, 0.1, 0.4);
  });
}

function playAlert(ctx: AudioContext, gain: GainNode): void {
  const t = ctx.currentTime;
  createTone(ctx, gain, 'square', 880, t, 0.12, 0.35, 0.08);
  createTone(ctx, gain, 'sine', 880, t, 0.12, 0.25, 0.08);
  createTone(ctx, gain, 'square', 880, t + 0.25, 0.12, 0.35, 0.08);
  createTone(ctx, gain, 'sine', 880, t + 0.25, 0.12, 0.25, 0.08);
}
