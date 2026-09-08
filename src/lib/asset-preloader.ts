"use client";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CORE_PRELOAD_IMAGES: string[] = [
  // Landing UI
  `${basePath}/game/ui/landing-background.png`,
  `${basePath}/game/ui/landing-overlay.png`,
  `${basePath}/game/ui/back.svg`,
  `${basePath}/game/ui/shadow.svg`,
  `${basePath}/game/photoshoot/background.png`,
  `${basePath}/game/photoshoot/camera.svg`,
  `${basePath}/game/effects/color-bubble-burst.gif`,

  // Base doll models
  `${basePath}/game/studio/layers/model.png`,

  // 17 active product preview stickers
  `${basePath}/game/studio/products/top-fitted-denim.png`,
  `${basePath}/game/studio/products/top-modal-grommet.png`,
  `${basePath}/game/studio/products/top-white-basic.png`,
  `${basePath}/game/studio/products/top-black-tee.png`,
  `${basePath}/game/studio/products/top-white-lace.png`,
  `${basePath}/game/studio/products/top-gray-v.png`,
  `${basePath}/game/studio/products/top-ivory-pointelle.png`,
  `${basePath}/game/studio/products/top-red-offshoulder.png`,
  `${basePath}/game/studio/products/bottom-sculpted-jeans.png`,
  `${basePath}/game/studio/products/bottom-denim-sculpted-skirt.png`,
  `${basePath}/game/studio/products/bottom-blue-jeans.png`,
  `${basePath}/game/studio/products/bottom-white-shorts.png`,
  `${basePath}/game/studio/products/bottom-black-mini.png`,
  `${basePath}/game/studio/products/bottom-navy-dots.png`,
  `${basePath}/game/studio/products/bottom-white-pleats.png`,
  `${basePath}/game/studio/products/bottom-gray-maxi.png`,
  `${basePath}/game/studio/products/shoes-mary-janes.png`,

  // Active runtime layers
  `${basePath}/game/studio/layers/top-fitted-denim.png`,
  `${basePath}/game/studio/layers/top-modal-grommet.png`,
  `${basePath}/game/studio/layers/top-white-basic.png`,
  `${basePath}/game/studio/layers/top-black-tee.png`,
  `${basePath}/game/studio/layers/top-white-lace.png`,
  `${basePath}/game/studio/layers/top-gray-v.png`,
  `${basePath}/game/studio/layers/top-ivory-pointelle.png`,
  `${basePath}/game/studio/layers/top-red-offshoulder.png`,
  `${basePath}/game/studio/layers/bottom-sculpted-jeans.png`,
  `${basePath}/game/studio/layers/bottom-denim-sculpted-skirt.png`,
  `${basePath}/game/studio/layers/bottom-blue-jeans.png`,
  `${basePath}/game/studio/layers/bottom-white-shorts.png`,
  `${basePath}/game/studio/layers/bottom-black-mini.png`,
  `${basePath}/game/studio/layers/bottom-navy-dots.png`,
  `${basePath}/game/studio/layers/bottom-white-pleats.png`,
  `${basePath}/game/studio/layers/bottom-gray-maxi.png`,
  `${basePath}/game/studio/layers/shoes-mary-janes.png`,
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
const PRELOAD_STORAGE_KEY = "tung_tung_preloaded_v4";

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
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(resolve).catch(() => reject(new Error(`Unable to decode ${url}`)));
      } else {
        resolve();
      }
    };
    img.onerror = () => reject(new Error(`Unable to load ${url}`));
    img.src = url;
    if (img.complete && img.naturalWidth > 0) resolve();
  });
}

async function preloadSingleAudio(url: string): Promise<void> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
  await response.arrayBuffer();
}

async function withRetry(load: () => Promise<void>, retries = 2): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await load();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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

  // Process in batches of 6 for fast parallel downloading without socket saturation
  const batchSize = 6;
  for (let i = 0; i < total; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await withRetry(() => item.type === "image"
            ? preloadSingleImage(item.url)
            : preloadSingleAudio(item.url));
        } finally {
          completed++;
          onProgress?.(Math.min(100, Math.round((completed / total) * 100)));
        }
      })
    );
  }

  markAssetsPreloaded();
  onProgress?.(100);
}
