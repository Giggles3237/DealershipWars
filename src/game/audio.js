// Lightweight synthesized sound effects so the MVP ships without audio assets.

let context = null;

function getContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    context = new AudioContextClass();
  }

  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }

  return context;
}

function tone(ctx, { frequency, type = 'sine', start = 0, duration = 0.15, volume = 0.2, slideTo = null }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime + start;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
}

function noise(ctx, { start = 0, duration = 0.12, volume = 0.12, filterFrequency = 2400 }) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const now = ctx.currentTime + start;

  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = filterFrequency;
  gain.gain.value = volume;

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
}

const SOUNDS = {
  cardPlay(ctx) {
    noise(ctx, { duration: 0.14, filterFrequency: 2800, volume: 0.16 });
  },
  cardDraw(ctx) {
    noise(ctx, { duration: 0.1, filterFrequency: 3600, volume: 0.1 });
  },
  attach(ctx) {
    noise(ctx, { duration: 0.08, filterFrequency: 2000, volume: 0.1 });
    tone(ctx, { frequency: 660, duration: 0.08, volume: 0.08 });
  },
  chime(ctx) {
    tone(ctx, { frequency: 880, duration: 0.25, volume: 0.16 });
    tone(ctx, { frequency: 1318, start: 0.12, duration: 0.3, volume: 0.14 });
    tone(ctx, { frequency: 1760, start: 0.24, duration: 0.4, volume: 0.12 });
  },
  cashRegister(ctx) {
    tone(ctx, { frequency: 1567, type: 'square', duration: 0.07, volume: 0.07 });
    tone(ctx, { frequency: 2093, type: 'square', start: 0.08, duration: 0.09, volume: 0.07 });
    noise(ctx, { start: 0.18, duration: 0.18, filterFrequency: 900, volume: 0.14 });
  },
  cheer(ctx) {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      tone(ctx, { frequency, start: index * 0.07, duration: 0.22, volume: 0.12 });
    });
  },
  groan(ctx) {
    tone(ctx, { frequency: 220, type: 'sawtooth', duration: 0.5, volume: 0.1, slideTo: 110 });
  },
  alarm(ctx) {
    tone(ctx, { frequency: 740, type: 'square', duration: 0.16, volume: 0.08 });
    tone(ctx, { frequency: 740, type: 'square', start: 0.24, duration: 0.16, volume: 0.08 });
    tone(ctx, { frequency: 740, type: 'square', start: 0.48, duration: 0.16, volume: 0.08 });
  },
  slam(ctx) {
    tone(ctx, { frequency: 100, type: 'sine', duration: 0.3, volume: 0.3, slideTo: 40 });
    noise(ctx, { duration: 0.2, filterFrequency: 500, volume: 0.2 });
  },
  ghost(ctx) {
    tone(ctx, { frequency: 880, type: 'sine', duration: 0.7, volume: 0.08, slideTo: 220 });
  },
  papers(ctx) {
    for (let index = 0; index < 5; index += 1) {
      noise(ctx, { start: index * 0.09, duration: 0.08, filterFrequency: 3200, volume: 0.07 });
    }
  }
};

export function playSound(name) {
  const ctx = getContext();
  const sound = SOUNDS[name];

  if (!ctx || !sound) {
    return;
  }

  try {
    sound(ctx);
  } catch {
    // Audio is decorative; never let it break gameplay.
  }
}

export function unlockAudio() {
  getContext();
}
