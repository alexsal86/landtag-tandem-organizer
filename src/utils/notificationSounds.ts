// Synthesized notification sounds using Web Audio API
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

export type SoundName = typeof NOTIFICATION_SOUNDS[number]['value'];

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Helper: create an oscillator with gain envelope
function createTone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  startTime: number,
  duration: number,
  gainValue: number = 0.5,
  decayTime?: number
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  // Attack
  env.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
  // Sustain then decay
  const decay = decayTime ?? duration * 0.7;
  env.gain.setValueAtTime(gainValue, startTime + duration - decay);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playNotificationSound(soundName: SoundName, volume: number = 0.5) {
  if (soundName === 'custom') {
    playCustomSound(volume);
    return;
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
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
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
}

function playCustomSound(volume: number) {
  const dataUrl = localStorage.getItem('custom_notification_sound');
  if (!dataUrl) return;
  const audio = new Audio(dataUrl);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(console.error);
}

export function hasCustomSound(): boolean {
  return !!localStorage.getItem('custom_notification_sound');
}

export function saveCustomSound(dataUrl: string) {
  localStorage.setItem('custom_notification_sound', dataUrl);
}

export function removeCustomSound() {
  localStorage.removeItem('custom_notification_sound');
}

// ─── PING: Two ascending friendly tones ───
function playPing(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  // First tone
  createTone(ctx, gain, 'sine', 880, t, 0.2, 0.6, 0.15);
  // Second tone, higher
  createTone(ctx, gain, 'sine', 1174, t + 0.15, 0.35, 0.5, 0.25);
}

// ─── BELL: Rich bell with harmonics and long decay ───
function playBell(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  const fundamentals = [800, 1600, 2400, 3200];
  const gains = [0.5, 0.3, 0.15, 0.08];
  const durations = [0.8, 0.6, 0.4, 0.3];

  fundamentals.forEach((freq, i) => {
    createTone(ctx, gain, 'sine', freq, t, durations[i], gains[i], durations[i] * 0.8);
  });
}

// ─── POP: Water drop with frequency sweep ───
function playPop(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // Start low, sweep up, then back down
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

// ─── SUBTLE: Soft two-note motif with triangle wave ───
function playSubtle(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  // Note 1: E5
  createTone(ctx, gain, 'triangle', 659, t, 0.25, 0.3, 0.2);
  // Note 2: G5
  createTone(ctx, gain, 'triangle', 784, t + 0.25, 0.35, 0.25, 0.3);
}

// ─── CHIME: Ascending C-E-G triad (kept as before, refined) ───
function playChime(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const start = t + i * 0.12;
    createTone(ctx, gain, 'sine', freq, start, 0.5, 0.45, 0.4);
    // Add octave harmonic for richness
    createTone(ctx, gain, 'sine', freq * 2, start, 0.3, 0.12, 0.25);
  });
}

// ─── MELODY: 4-note melodic phrase ───
function playMelody(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  const notes = [
    { freq: 523, dur: 0.2 },  // C5
    { freq: 659, dur: 0.2 },  // E5
    { freq: 784, dur: 0.2 },  // G5
    { freq: 1047, dur: 0.5 }, // C6 (longer final note)
  ];
  let offset = 0;
  notes.forEach(({ freq, dur }) => {
    createTone(ctx, gain, 'sine', freq, t + offset, dur, 0.4, dur * 0.6);
    createTone(ctx, gain, 'triangle', freq, t + offset, dur * 0.8, 0.1, dur * 0.5);
    offset += dur * 0.85; // slight overlap
  });
}

// ─── HARP: Fast ascending arpeggio with triangle wave ───
function playHarp(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  const notes = [392, 494, 587, 740, 988]; // G4 B4 D5 F#5 B5
  notes.forEach((freq, i) => {
    const start = t + i * 0.08;
    createTone(ctx, gain, 'triangle', freq, start, 0.6, 0.35 - i * 0.03, 0.5);
    // Subtle sine doubling
    createTone(ctx, gain, 'sine', freq * 1.002, start, 0.5, 0.1, 0.4);
  });
}

// ─── ALERT: Two identical short attention tones ───
function playAlert(ctx: AudioContext, gain: GainNode) {
  const t = ctx.currentTime;
  // First beep
  createTone(ctx, gain, 'square', 880, t, 0.12, 0.35, 0.08);
  createTone(ctx, gain, 'sine', 880, t, 0.12, 0.25, 0.08);
  // Gap, then second beep
  createTone(ctx, gain, 'square', 880, t + 0.25, 0.12, 0.35, 0.08);
  createTone(ctx, gain, 'sine', 880, t + 0.25, 0.12, 0.25, 0.08);
}
