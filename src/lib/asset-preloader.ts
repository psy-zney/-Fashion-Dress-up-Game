"use client";

import { allGarments, assetUrl, previewAssetUrl } from './studio';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CORE_PRELOAD_IMAGES: string[] = [
  // Landing UI
  `${basePath}/game/ui/landing-background.png`,
  `${basePath}/game/ui/landing-overlay.png`,
  `${basePath}/game/ui/back.svg`,
  `${basePath}/game/ui/shadow.svg`,
  `${basePath}/game/ui/back-button-glossy.png`,
  `${basePath}/game/ui/category-wheel-pink.webp`,
  `${basePath}/game/ui/wardrobe-cabinet-glossy.webp`,
  `${basePath}/game/ui/pick-an-outfit-header.png`,
  `${basePath}/game/backgrounds/slide-playground.webp`,
  `${basePath}/game/photoshoot/background.png`,
  `${basePath}/game/photoshoot/camera.svg`,
  `${basePath}/game/effects/color-bubble-burst.gif`,

  ...['model', 'model-boots', 'model-arms', 'model-lower', 'model-lower-boots', 'top-fitted-denim-pose', 'top-modal-grommet-pose', 'bottom-sculpted-jeans-under-yellow'].map(assetUrl),
  ...allGarments.map(({ id }) => previewAssetUrl(id)),
  ...allGarments.map(({ id }) => assetUrl(id)),
];

export const CORE_PRELOAD_AUDIO: string[] = [
  `${basePath}/game/Music/BackgroundMusic.mp3?v=20260908`,
  `${basePath}/game/effects/click_btn.mp3`,
  `${basePath}/game/effects/particles_sparkle_small.mp3`,
  `${basePath}/game/effects/particles_sparkle_small 2.mp3?v=20260908-boing`,
  `${basePath}/game/effects/buble.mp3`,
];

let isGlobalPreloaded = false;
let activePreload: Promise<void> | null = null;
const PRELOAD_STORAGE_KEY = "tung_tung_preloaded_production_v2_v10_yellow_over_jeans";

export function isAssetsPreloaded(): boolean {
  if (isGlobalPreloaded) return true;
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem(PRELOAD_STORAGE_KEY) === "true") {
        isGlobalPreloaded = true;
        return true;
      }
    } catch {
      // Ignore storage errors
    }
  }
  return false;
}

export function markAssetsPreloaded() {
  isGlobalPreloaded = true;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(PRELOAD_STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  }
}

function preloadSingleImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = url;
    if (img.complete && img.naturalWidth > 0) resolve();
  });
}

async function preloadSingleAudio(url: string): Promise<void> {
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (response.ok) await response.arrayBuffer();
  } catch {
    // Non-blocking
  }
}

export async function preloadAllAssets(
  onProgress?: (progress: number) => void,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!options.force && isAssetsPreloaded()) {
    onProgress?.(100);
    return;
  }

  if (activePreload) {
    await activePreload;
    onProgress?.(100);
    return;
  }

  activePreload = preloadAssets(onProgress);
  try {
    await activePreload;
  } finally {
    activePreload = null;
  }
}

async function preloadAssets(onProgress?: (progress: number) => void): Promise<void> {
  const allItems = [
    ...CORE_PRELOAD_IMAGES.map((url) => ({ type: "image" as const, url })),
    ...CORE_PRELOAD_AUDIO.map((url) => ({ type: "audio" as const, url })),
  ];

  let completed = 0;
  const total = allItems.length;

  await Promise.all(
    allItems.map(async (item) => {
      try {
        if (item.type === "image") {
          await preloadSingleImage(item.url);
        } else {
          await preloadSingleAudio(item.url);
        }
      } finally {
        completed++;
        onProgress?.(Math.min(100, Math.round((completed / total) * 100)));
      }
    })
  );

  markAssetsPreloaded();
  onProgress?.(100);
}
