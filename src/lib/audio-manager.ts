"use client";

import { setSfxVolume, preloadAudio } from "./sound-effects";

export interface AudioSettings {
  masterVolume: number; // 0 to 100: controls ALL sounds
  bgmEnabled: boolean;
  bgmVolume: number; // 0 to 100
  sfxEnabled: boolean;
  sfxVolume: number; // 0 to 100
}

const STORAGE_KEY = "dress_up_audio_settings_v2";
const LEGACY_STORAGE_KEY = "dress_up_audio_settings";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 100,
  bgmEnabled: true,
  bgmVolume: 25, // Gentle softer ambient level by default
  sfxEnabled: true,
  sfxVolume: 80,
};

let currentSettings: AudioSettings = { ...DEFAULT_SETTINGS };
let bgmAudio: HTMLAudioElement | null = null;
let initialized = false;
let unlockListenerAdded = false;
const listeners = new Set<(settings: AudioSettings) => void>();

function readSavedSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    const volume = typeof parsed.bgmVolume === "number"
      ? (parsed.bgmVolume === 50 && !localStorage.getItem(STORAGE_KEY) ? 25 : Math.max(0, Math.min(100, parsed.bgmVolume)))
      : DEFAULT_SETTINGS.bgmVolume;
    return {
      masterVolume: typeof parsed.masterVolume === "number" ? Math.max(0, Math.min(100, parsed.masterVolume)) : DEFAULT_SETTINGS.masterVolume,
      bgmEnabled: typeof parsed.bgmEnabled === "boolean" ? parsed.bgmEnabled : DEFAULT_SETTINGS.bgmEnabled,
      bgmVolume: volume,
      sfxEnabled: typeof parsed.sfxEnabled === "boolean" ? parsed.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
      sfxVolume: typeof parsed.sfxVolume === "number" ? Math.max(0, Math.min(100, parsed.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AudioSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

declare global {
  interface Window {
    __GAME_BGM_AUDIO__?: HTMLAudioElement;
    __GAME_BGM_CTX__?: AudioContext;
    __GAME_BGM_SOURCE__?: MediaElementAudioSourceNode;
    __GAME_BGM_GAIN__?: GainNode;
    __GAME_AUDIO_LISTENERS_INITIALIZED__?: boolean;
  }
}

function computePerceptualVolume(fraction: number): number {
  const clamped = Math.max(0, Math.min(1, fraction));
  // Quadratic perceptual taper (Weber-Fechner law): gives realistic human loudness perception
  return Math.pow(clamped, 2);
}

function getBgmGain(): { gain: GainNode | null; ctx: AudioContext | null } {
  if (typeof window === "undefined" || !bgmAudio) return { gain: null, ctx: null };

  if (window.__GAME_BGM_GAIN__ && window.__GAME_BGM_CTX__) {
    return { gain: window.__GAME_BGM_GAIN__, ctx: window.__GAME_BGM_CTX__ };
  }

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return { gain: null, ctx: null };

    const ctx = window.__GAME_BGM_CTX__ || new AudioContextClass({ latencyHint: "playback" });
    window.__GAME_BGM_CTX__ = ctx;

    const source = window.__GAME_BGM_SOURCE__ || ctx.createMediaElementSource(bgmAudio);
    window.__GAME_BGM_SOURCE__ = source;

    const gain = window.__GAME_BGM_GAIN__ || ctx.createGain();
    window.__GAME_BGM_GAIN__ = gain;

    source.connect(gain).connect(ctx.destination);
    return { gain, ctx };
  } catch {
    return { gain: null, ctx: null };
  }
}

function setupUnlockListener() {
  if (typeof window === "undefined") return;

  const unlock = () => {
    const { gain, ctx } = getBgmGain();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    if (bgmAudio) {
      if (bgmAudio.error) {
        try { bgmAudio.load(); } catch { /* ignore */ }
      }
      const fraction = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
      if (currentSettings.bgmEnabled && fraction > 0) {
        bgmAudio.muted = false;
        const perceptualGain = computePerceptualVolume(fraction);
        try { bgmAudio.volume = perceptualGain; } catch { /* ignore */ }
        if (gain && ctx) {
          gain.gain.setValueAtTime(perceptualGain, ctx.currentTime);
        }
        if (bgmAudio.paused) {
          bgmAudio.play().then(() => {
            const events = ["pointerdown", "touchstart", "mousedown", "keydown", "click"];
            events.forEach((evt) => window.removeEventListener(evt, unlock, true));
            unlockListenerAdded = false;
          }).catch(() => {});
          return;
        }
      }
    }
    const events = ["pointerdown", "touchstart", "mousedown", "keydown", "click"];
    events.forEach((evt) => window.removeEventListener(evt, unlock, true));
    unlockListenerAdded = false;
  };

  if (!unlockListenerAdded) {
    unlockListenerAdded = true;
    const events = ["pointerdown", "touchstart", "mousedown", "keydown", "click"];
    events.forEach((evt) => window.addEventListener(evt, unlock, { capture: true }));
  }
}

export async function playBgmSafely(): Promise<boolean> {
  if (!bgmAudio) return false;

  if (bgmAudio.error) {
    try { bgmAudio.load(); } catch { /* ignore */ }
  }

  const fraction = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
  if (!currentSettings.bgmEnabled || fraction <= 0) {
    bgmAudio.pause();
    return false;
  }

  const perceptualGain = computePerceptualVolume(fraction);

  // Set HTMLAudioElement volume (works on Desktop browsers)
  try {
    bgmAudio.volume = perceptualGain;
  } catch { /* ignore */ }

  // Set Web Audio GainNode (works on iOS Safari, Android, and Desktop)
  const { gain, ctx } = getBgmGain();
  if (gain && ctx) {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    gain.gain.setValueAtTime(perceptualGain, ctx.currentTime);
  }

  // If already playing unmuted, volume was updated above
  if (!bgmAudio.paused && !bgmAudio.muted) {
    return true;
  }

  // Attempt 1: Direct unmuted play
  try {
    bgmAudio.muted = false;
    await bgmAudio.play();
    return true;
  } catch {
    // Direct unmuted play blocked by browser policy
  }

  // Attempt 2: Muted play -> unmuted transition
  try {
    bgmAudio.muted = true;
    await bgmAudio.play();
    bgmAudio.muted = false;
    if (!bgmAudio.paused) {
      return true;
    }
  } catch {
    // Blocked by strict policy
  }

  // Attempt 3: Register global capture listener for earliest user gesture
  setupUnlockListener();
  return false;
}

export function applyBgmState() {
  if (!bgmAudio) return;

  const fraction = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
  if (!currentSettings.bgmEnabled || fraction <= 0) {
    bgmAudio.pause();
    const { gain, ctx } = getBgmGain();
    if (gain && ctx) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
    }
    return;
  }

  const perceptualGain = computePerceptualVolume(fraction);

  try {
    bgmAudio.volume = perceptualGain;
  } catch { /* ignore */ }

  const { gain, ctx } = getBgmGain();
  if (gain && ctx) {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    gain.gain.setValueAtTime(perceptualGain, ctx.currentTime);
  }

  void playBgmSafely();
}

const BGM_SRC = `${basePath}/game/Music/BackgroundMusic.mp3?v=20260908`;

export function initAudio(): AudioSettings {
  if (typeof window === "undefined") return currentSettings;

  if (!initialized) {
    currentSettings = readSavedSettings();
    setSfxVolume(currentSettings.sfxVolume, currentSettings.sfxEnabled, currentSettings.masterVolume);

    // Prevent duplicate audio objects across Fast Refresh, preview tabs, or multiple calls
    if (window.__GAME_BGM_AUDIO__) {
      bgmAudio = window.__GAME_BGM_AUDIO__;
      if (!bgmAudio.src.includes("BackgroundMusic.mp3?v=20260908")) {
        bgmAudio.src = BGM_SRC;
        bgmAudio.load();
      }
    } else {
      bgmAudio = new Audio(BGM_SRC);
      bgmAudio.loop = true;
      bgmAudio.preload = "auto";
      bgmAudio.load();
      window.__GAME_BGM_AUDIO__ = bgmAudio;

      // Guaranteed loop fallback across all mobile & desktop browsers
      bgmAudio.addEventListener("ended", () => {
        const effective = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
        if (bgmAudio && currentSettings.bgmEnabled && effective > 0) {
          bgmAudio.currentTime = 0;
          bgmAudio.play().catch(() => {});
        }
      });
    }

    if (!window.__GAME_AUDIO_LISTENERS_INITIALIZED__) {
      window.__GAME_AUDIO_LISTENERS_INITIALIZED__ = true;

      // Pause audio whenever tab is hidden (prevents duplicate audio across preview windows/tabs)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          if (bgmAudio) bgmAudio.pause();
        } else if (document.visibilityState === "visible") {
          applyBgmState();
          setupUnlockListener();
        }
      });

      window.addEventListener("pagehide", () => {
        if (bgmAudio) bgmAudio.pause();
      });

      window.addEventListener("beforeunload", () => {
        if (bgmAudio) bgmAudio.pause();
      });
    }

    initialized = true;
  }

  // Always re-arm unlock listener and refresh BGM state on each initAudio call
  setupUnlockListener();
  applyBgmState();

  return currentSettings;
}

export function getAudioSettings(): AudioSettings {
  return currentSettings;
}

export function updateAudioSettings(next: Partial<AudioSettings>): AudioSettings {
  currentSettings = {
    ...currentSettings,
    ...next,
  };

  // Clamp numbers
  currentSettings.masterVolume = Math.max(0, Math.min(100, currentSettings.masterVolume ?? 100));
  currentSettings.bgmVolume = Math.max(0, Math.min(100, currentSettings.bgmVolume));
  currentSettings.sfxVolume = Math.max(0, Math.min(100, currentSettings.sfxVolume));

  saveSettings(currentSettings);
  applyBgmState();
  setSfxVolume(currentSettings.sfxVolume, currentSettings.sfxEnabled, currentSettings.masterVolume);

  listeners.forEach((listener) => {
    try {
      listener(currentSettings);
    } catch {
      // Ignore listener error
    }
  });

  return currentSettings;
}

export function subscribeAudioSettings(listener: (settings: AudioSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadMusicWithProgress(onProgress: (percent: number) => void): Promise<void> {
  if (typeof window === "undefined") {
    onProgress(100);
    return;
  }

  // Preload sound effects buffers and initialize audio early
  preloadAudio();
  initAudio();

  // Extend loading time by +2s as requested: total duration ~2.65s (original 650ms + 2000ms)
  // Step-by-step realistic and smooth progression:
  const steps = [
    { p: 14, delay: 280 },
    { p: 28, delay: 320 },
    { p: 45, delay: 350 },
    { p: 63, delay: 380 },
    { p: 78, delay: 360 },
    { p: 89, delay: 340 },
    { p: 96, delay: 320 },
    { p: 100, delay: 300 },
  ];

  for (const step of steps) {
    onProgress(step.p);
    await new Promise((r) => setTimeout(r, step.delay));
  }

  // Start background music immediately as loading completes
  await playBgmSafely();
}
