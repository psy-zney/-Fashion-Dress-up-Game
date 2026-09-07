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

function applyBgmState() {
  if (!bgmAudio) return;

  const effectiveVolume = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
  if (currentSettings.bgmEnabled && effectiveVolume > 0) {
    bgmAudio.volume = Math.max(0, Math.min(1, effectiveVolume));
    if (bgmAudio.paused) {
      bgmAudio.play().catch(() => {
        setupUnlockListener();
      });
    }
  } else {
    bgmAudio.pause();
  }
}

function setupUnlockListener() {
  if (unlockListenerAdded || typeof window === "undefined") return;
  unlockListenerAdded = true;

  const unlock = () => {
    const effectiveVolume = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
    if (bgmAudio && currentSettings.bgmEnabled && effectiveVolume > 0 && bgmAudio.paused) {
      bgmAudio.play().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    unlockListenerAdded = false;
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function initAudio(): AudioSettings {
  if (typeof window === "undefined") return currentSettings;

  if (!initialized) {
    currentSettings = readSavedSettings();
    setSfxVolume(currentSettings.sfxVolume, currentSettings.sfxEnabled, currentSettings.masterVolume);

    bgmAudio = new Audio(`${basePath}/game/Music/BackgroundMusic.mp3`);
    bgmAudio.loop = true;
    bgmAudio.preload = "auto";

    // Guaranteed loop fallback across all mobile & desktop browsers
    bgmAudio.addEventListener("ended", () => {
      const effective = (currentSettings.bgmVolume / 100) * (currentSettings.masterVolume / 100);
      if (bgmAudio && currentSettings.bgmEnabled && effective > 0) {
        bgmAudio.currentTime = 0;
        bgmAudio.play().catch(() => {});
      }
    });

    // Resume BGM loop when user returns to the tab
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        applyBgmState();
      }
    });

    applyBgmState();
    initialized = true;
  }

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

  // Preload sound effects buffers concurrently
  preloadAudio();

  // Smooth loading progression that mirrors loading soundtrack
  const steps = [18, 42, 68, 88, 100];
  for (const p of steps) {
    onProgress(p);
    await new Promise((r) => setTimeout(r, 130));
  }

  initAudio();
  applyBgmState();
}
