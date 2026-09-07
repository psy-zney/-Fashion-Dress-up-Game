"use client";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CORE_PRELOAD_IMAGES: string[] = [
  // Landing UI
  `${basePath}/game/ui/landing-background.png`,
  `${basePath}/game/ui/landing-overlay.png`,
  `${basePath}/game/ui/back.svg`,
  `${basePath}/game/ui/shadow.svg`,

  // Base doll models
  `${basePath}/game/studio/layers/model.png`,

  // 5 active product preview stickers
  `${basePath}/game/studio/products/top-fitted-denim.png`,
  `${basePath}/game/studio/products/top-modal-grommet.png`,
  `${basePath}/game/studio/products/bottom-sculpted-jeans.png`,
  `${basePath}/game/studio/products/bottom-denim-sculpted-skirt.png`,
  `${basePath}/game/studio/products/shoes-mary-janes.png`,

  // Active runtime layers
  `${basePath}/game/studio/layers/top-fitted-denim.png`,
  `${basePath}/game/studio/layers/top-modal-grommet.png`,
  `${basePath}/game/studio/layers/bottom-sculpted-jeans.png`,
  `${basePath}/game/studio/layers/bottom-denim-sculpted-skirt.png`,
  `${basePath}/game/studio/layers/shoes-mary-janes.png`,
];

export const CORE_PRELOAD_AUDIO: string[] = [
  `${basePath}/game/Music/BackgroundMusic.mp3`,
  `${basePath}/game/effects/click_btn.mp3`,
  `${basePath}/game/effects/particles_sparkle_small.mp3`,
  `${basePath}/game/effects/particles_sparkle_small 2.mp3`,
];

let isGlobalPreloaded = false;

export function isAssetsPreloaded(): boolean {
  if (isGlobalPreloaded) return true;
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem("tung_tung_preloaded_v1") === "true") {
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
      sessionStorage.setItem("tung_tung_preloaded_v1", "true");
    } catch {
      // Ignore storage errors
    }
  }
}

function preloadSingleImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve(); // don't block
  });
}

async function preloadSingleAudio(url: string): Promise<void> {
  try {
    await fetch(url);
  } catch {
    // Continue
  }
}

export async function preloadAllAssets(onProgress?: (progress: number) => void): Promise<void> {
  if (isAssetsPreloaded()) {
    onProgress?.(100);
    return;
  }

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
          if (item.type === "image") {
            await preloadSingleImage(item.url);
          } else {
            await preloadSingleAudio(item.url);
          }
        } catch {
          // Continue on errors
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
