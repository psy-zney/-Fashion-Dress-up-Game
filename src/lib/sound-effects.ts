"use client";

export type SoundEffect =
  | "click"
  | "tap"
  | "play"
  | "panelOpen"
  | "panelClose"
  | "category"
  | "pickup"
  | "drop"
  | "cancel"
  | "dress"
  | "showcase"
  | "back";

type AudioEngine = {
  context: AudioContext;
  sfxBus: GainNode;
  noise: AudioBuffer;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CLICK_SOUND_URL = `${basePath}/game/effects/click_btn.mp3`;
const DRESS_SOUND_URL = `${basePath}/game/effects/particles_sparkle_small 2.mp3`;
const BUBBLE_SOUND_URL = `${basePath}/game/effects/buble.mp3`;

let engine: AudioEngine | null = null;
let sfxEnabled = true;
let sfxVolume = 80;
let clickBuffer: AudioBuffer | null = null;
let dressBuffer: AudioBuffer | null = null;
let bubbleBuffer: AudioBuffer | null = null;
let bubbleStartOffsetSec = 0;
let isPreloading = false;

const dbToGain = (decibels: number) => 10 ** (decibels / 20);

function findAudioLeadSilence(buffer: AudioBuffer, threshold = 0.006): number {
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) {
    if (Math.abs(channel[i]) > threshold) {
      return Math.max(0, (i - 10) / buffer.sampleRate);
    }
  }
  return 0;
}

async function preloadSoundBuffers(context: AudioContext) {
  if (isPreloading || (clickBuffer && dressBuffer && bubbleBuffer)) return;
  isPreloading = true;

  try {
    const [clickRes, dressRes, bubbleRes] = await Promise.all([
      fetch(encodeURI(CLICK_SOUND_URL)),
      fetch(encodeURI(DRESS_SOUND_URL)),
      fetch(encodeURI(BUBBLE_SOUND_URL)),
    ]);

    if (clickRes.ok) {
      const arr = await clickRes.arrayBuffer();
      clickBuffer = await context.decodeAudioData(arr);
    }
    if (dressRes.ok) {
      const arr = await dressRes.arrayBuffer();
      dressBuffer = await context.decodeAudioData(arr);
    }
    if (bubbleRes.ok) {
      const arr = await bubbleRes.arrayBuffer();
      bubbleBuffer = await context.decodeAudioData(arr);
      bubbleStartOffsetSec = findAudioLeadSilence(bubbleBuffer);
    }
  } catch (e) {
    // Non-fatal, falls back to Web Audio synthesis
    console.warn("Could not preload audio files:", e);
  } finally {
    isPreloading = false;
  }
}

function playSample(audio: AudioEngine, buffer: AudioBuffer, gainFactor: number = 1, playbackRate: number = 1) {
  try {
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    if (gainFactor !== 1) {
      const gain = audio.context.createGain();
      gain.gain.value = gainFactor;
      source.connect(gain).connect(audio.sfxBus);
    } else {
      source.connect(audio.sfxBus);
    }
    source.start(0);
  } catch {
    // Ignore playback error if audio context was interrupted
  }
}

function createEngine(): AudioEngine | null {
  if (typeof window === "undefined") return null;

  try {
    const context = new AudioContext({ latencyHint: "interactive" });
    const sfxBus = context.createGain();
    const limiter = context.createDynamicsCompressor();

    sfxBus.gain.value = (!sfxEnabled || sfxVolume <= 0) ? 0 : dbToGain(-5) * (sfxVolume / 100);
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    sfxBus.connect(limiter).connect(context.destination);

    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = noise.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    void preloadSoundBuffers(context);

    return { context, sfxBus, noise };
  } catch {
    return null;
  }
}

function getEngine() {
  if (!engine || engine.context.state === "closed") engine = createEngine();
  return engine;
}

function tone(
  audio: AudioEngine,
  at: number,
  fromHz: number,
  toHz: number,
  duration: number,
  decibels: number,
  type: OscillatorType = "sine",
) {
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const peak = dbToGain(decibels);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromHz, at);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.012, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  oscillator.connect(gain).connect(audio.sfxBus);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

function filteredNoise(
  audio: AudioEngine,
  at: number,
  duration: number,
  fromHz: number,
  toHz: number,
  decibels: number,
) {
  const source = audio.context.createBufferSource();
  const filter = audio.context.createBiquadFilter();
  const gain = audio.context.createGain();
  const peak = dbToGain(decibels);

  source.buffer = audio.noise;
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(fromHz, at);
  filter.frequency.exponentialRampToValueAtTime(toHz, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.01, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(filter).connect(gain).connect(audio.sfxBus);
  source.start(at);
  source.stop(at + duration);
}

function render(effect: SoundEffect, audio: AudioEngine) {
  const now = audio.context.currentTime + 0.006;

  // Make sure buffers are preloading if not already
  if (!clickBuffer && !dressBuffer && !isPreloading) {
    void preloadSoundBuffers(audio.context);
  }

  switch (effect) {
    case "click":
    case "tap":
    case "category":
    case "panelClose":
    case "back":
      if (clickBuffer) {
        playSample(audio, clickBuffer);
      } else {
        tone(audio, now, 610, 720, 0.055, -24, "sine");
      }
      break;

    case "dress":
    case "drop":
      if (dressBuffer) {
        playSample(audio, dressBuffer);
      } else {
        const variation = 0.97 + Math.random() * 0.06;
        filteredNoise(audio, now, 0.15, 850 * variation, 2600 * variation, -29);
        tone(audio, now + 0.035, 410 * variation, 590 * variation, 0.15, -23, "triangle");
        tone(audio, now + 0.085, 620 * variation, 760 * variation, 0.12, -27, "sine");
      }
      break;

    case "play":
      tone(audio, now, 392, 523, 0.16, -20, "triangle");
      tone(audio, now + 0.075, 523, 659, 0.18, -20, "triangle");
      tone(audio, now + 0.15, 659, 784, 0.24, -19, "triangle");
      filteredNoise(audio, now + 0.12, 0.22, 1800, 5200, -31);
      break;

    case "panelOpen":
      if (clickBuffer) {
        playSample(audio, clickBuffer);
      } else {
        tone(audio, now, 270, 460, 0.12, -23, "triangle");
        filteredNoise(audio, now, 0.09, 900, 2300, -34);
      }
      break;

    case "pickup":
      // Crisp cloth rustle + pickup whoosh ("kéo đồ")
      if (clickBuffer) {
        playSample(audio, clickBuffer, 0.85, 1.45);
      }
      // Distinct dual-tone pickup whoosh + crisp fabric rustle
      tone(audio, now, 320, 680, 0.11, -8, "triangle");
      tone(audio, now + 0.015, 480, 920, 0.09, -10, "sine");
      filteredNoise(audio, now, 0.1, 1400, 5400, -14);
      break;

    case "cancel":
      tone(audio, now, 260, 190, 0.075, -29, "sine");
      break;

    case "showcase":
      filteredNoise(audio, now, 0.48, 1400, 6200, -32);
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone(audio, now + index * 0.075, frequency * 0.96, frequency, 0.3, -22 - index, "triangle");
      });
      break;
  }
}

export function preloadAudio() {
  const audio = getEngine();
  if (audio) {
    if (audio.context.state === "suspended") {
      void audio.context.resume();
    }
    void preloadSoundBuffers(audio.context);
  }
}

let masterVolume = 100;

export function setSfxVolume(volume: number, enabled: boolean = true, master: number = 100) {
  sfxVolume = Math.max(0, Math.min(100, volume));
  sfxEnabled = enabled;
  masterVolume = Math.max(0, Math.min(100, master));

  const audio = getEngine();
  if (audio) {
    if (!sfxEnabled || sfxVolume <= 0 || masterVolume <= 0) {
      audio.sfxBus.gain.value = 0;
    } else {
      audio.sfxBus.gain.value = dbToGain(-5) * (sfxVolume / 100) * (masterVolume / 100);
    }
  }
}

export function playBubblePop(pitchMod: number = 1) {
  if (!sfxEnabled || sfxVolume <= 0 || masterVolume <= 0) return;
  const audio = getEngine();
  if (!audio) return;
  if (audio.context.state === "suspended") {
    void audio.context.resume();
  }

  // Play pre-decoded buble.mp3 with zero delay and punchy volume
  if (bubbleBuffer) {
    try {
      const source = audio.context.createBufferSource();
      source.buffer = bubbleBuffer;
      source.playbackRate.value = Math.max(0.75, Math.min(1.45, pitchMod));
      const gain = audio.context.createGain();
      // "soung buble nổ to thêm 1 xíu" -> clear, louder pop
      gain.gain.value = 1.45;
      source.connect(gain).connect(audio.sfxBus);
      source.start(0, bubbleStartOffsetSec);
      return;
    } catch {
      // fallback to synth
    }
  }

  // Fallback organic synth pop if buffer is still loading
  const now = audio.context.currentTime;
  try {
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();

    osc.type = "sine";
    const startFreq = (640 + Math.random() * 80) * pitchMod;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(110 * pitchMod, now + 0.038);

    const baseGain = dbToGain(-6) * (sfxVolume / 100) * (masterVolume / 100);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(baseGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain).connect(audio.sfxBus);
    osc.start(now);
    osc.stop(now + 0.048);
  } catch {
    // Ignore error
  }
}

export function isSfxEnabled(): boolean {
  return sfxEnabled && sfxVolume > 0;
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function playSound(effect: SoundEffect) {
  if (!sfxEnabled || sfxVolume <= 0) return;

  const audio = getEngine();
  if (!audio) return;

  const requestedAt = performance.now();
  if (audio.context.state === "suspended") {
    void audio.context.resume().then(() => {
      if (performance.now() - requestedAt < 250) render(effect, audio);
    }).catch(() => undefined);
    return;
  }

  if (audio.context.state === "running") render(effect, audio);
}
