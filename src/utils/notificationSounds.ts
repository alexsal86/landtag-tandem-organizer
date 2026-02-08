// Synthesized notification sounds using Web Audio API
export const NOTIFICATION_SOUNDS = [
  { value: 'ping', label: 'Ping' },
  { value: 'bell', label: 'Glocke' },
  { value: 'pop', label: 'Plopp' },
  { value: 'subtle', label: 'Dezent' },
  { value: 'chime', label: 'Klang' },
] as const;

export type SoundName = typeof NOTIFICATION_SOUNDS[number]['value'];

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playNotificationSound(soundName: SoundName, volume: number = 0.5) {
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
      default:
        playPing(ctx, gainNode);
    }
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
}

function playPing(ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function playBell(ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
  
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(1, ctx.currentTime);
  envGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  
  osc.connect(envGain);
  envGain.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
}

function playPop(ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
  osc.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

function playSubtle(ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.3, ctx.currentTime);
  envGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  
  osc.connect(envGain);
  envGain.connect(gain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

function playChime(ctx: AudioContext, gain: GainNode) {
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
    
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.1);
    envGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.25);
    
    osc.connect(envGain);
    envGain.connect(gain);
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + i * 0.1 + 0.25);
  });
}
