import { STAGE, assetUrl, bootTuckBottomIds, categories, allGarments, layerOrder, foregroundArmsOrder, foregroundArmsPath, type Category, type Selection } from "./studio";

export type Fit = { x: number; y: number; scaleX: number; scaleY: number; angle: number };
export type SavedStudio = {
  selected: Selection;
  fits: Record<string, Fit>;
  held: Partial<Record<Category, boolean>>;
};
export const initialFit: Fit = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 };
export const storageKey = "tung-tung-play-ge";
let currentLook: SavedStudio | undefined;

export function isSafeFit(value: unknown): value is Fit {
  if (!value || typeof value !== "object") return false;
  const fit = value as Fit;
  return [fit.x, fit.y, fit.scaleX, fit.scaleY, fit.angle].every(Number.isFinite) &&
    Math.abs(fit.x) <= 100 && Math.abs(fit.y) <= 100 &&
    fit.scaleX >= 0.7 && fit.scaleX <= 1.3 && fit.scaleY >= 0.7 && fit.scaleY <= 1.3 && Math.abs(fit.angle) <= 15;
}

export function rememberLook(look: SavedStudio) {
  // Keep navigation working even if this browser blocks persistent storage.
  currentLook = look;
  localStorage.setItem(storageKey, JSON.stringify(look));
}

export function readLook(): SavedStudio {
  let saved: Partial<SavedStudio> = currentLook || {};
  try { if (!currentLook) saved = JSON.parse(localStorage.getItem(storageKey) || "null") || {}; } catch { /* Use this session's look. */ }
  const selected: Selection = {};
  const fits: Record<string, Fit> = {};
  const held: Partial<Record<Category, boolean>> = {};
  categories.forEach(({ id }) => {
    if (allGarments.some((item) => item.id === saved.selected?.[id] && item.category === id)) {
      selected[id] = saved.selected?.[id];
      if (saved.held?.[id]) held[id] = true;
    }
  });
  allGarments.forEach(({ id }) => { if (isSafeFit(saved.fits?.[id])) fits[id] = saved.fits![id]; });
  return { selected, fits, held };
}

export async function renderLook({ selected, fits }: SavedStudio): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE.width;
  canvas.height = STAGE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const boots = selected.shoes === "shoes-brown-boots";
  const order = (category: Category) => category === "shoes" && boots && bootTuckBottomIds.has(selected.bottoms || "") ? 35 : layerOrder[category];
  const layers = [
    { id: boots ? "model-boots" : "model", fit: initialFit, clip: false, order: 0, arms: false },
    ...allGarments.filter((item) => selected[item.category] === item.id)
      .sort((a, b) => order(a.category) - order(b.category))
      .map((item) => ({ id: item.id, fit: fits[item.id] || initialFit, clip: boots && bootTuckBottomIds.has(item.id), order: order(item.category), arms: false })),
    { id: "model", fit: initialFit, clip: false, order: foregroundArmsOrder, arms: true },
  ].sort((a, b) => a.order - b.order);
  const images = await Promise.all(layers.map(async (layer) => {
    const image = new Image();
    image.src = assetUrl(layer.id);
    await image.decode();
    return image;
  }));
  layers.forEach(({ fit, clip, arms }, index) => {
    context.save();
    if (arms) context.clip(new Path2D(foregroundArmsPath));
    context.translate(STAGE.width / 2 + fit.x, STAGE.height / 2 + fit.y);
    context.rotate(fit.angle * Math.PI / 180);
    context.scale(fit.scaleX, fit.scaleY);
    const height = STAGE.height * (clip ? 0.648 : 1);
    context.drawImage(images[index], 0, 0, STAGE.width, height, -STAGE.width / 2, -STAGE.height / 2, STAGE.width, height);
    context.restore();
  });
  return canvas;
}
