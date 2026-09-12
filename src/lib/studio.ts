import { DEPLOY_VERSION, publicAsset } from "./public-asset";

export const STAGE = { width: 1024, height: 1536 } as const;
export const STUDIO_ASSET_VERSION = "production-v2-20260912-v15-face-safe";
// Product art is independently approved and must not change with layer releases.
export const STUDIO_PRODUCT_VERSION = "production-v2-20260909-v13-narrow-waistband";

export const categories = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
] as const;

export type Category = (typeof categories)[number]["id"];
export type Selection = Partial<Record<Category, string>>;

export type Garment = {
  id: string;
  name: string;
  category: Category;
  source: string;
};

export type GarmentBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// Visible alpha bounds from the current runtime asset report. The admin editor
// uses these to draw useful Canva-like handles around the garment, rather than
// around the full transparent 1024 × 1536 sprite canvas.
export const garmentBounds: Record<string, GarmentBounds> = {
  "top-fitted-denim": { left: 402, top: 250, width: 244, height: 406 },
  "top-modal-grommet": { left: 384, top: 274, width: 280, height: 389 },
  "bottom-sculpted-jeans": { left: 283, top: 541, width: 503, height: 898 },
  "shoes-party-platform-boots": { left: 394, top: 1236, width: 246, height: 268 },
};

export const garments: Garment[] = [
  { id: "top-fitted-denim", name: "Fitted Denim Top", category: "tops", source: "production-v2-white" },
  { id: "top-modal-grommet", name: "Modal Grommet Top", category: "tops", source: "production-v2-red-stitching" },
  { id: "bottom-sculpted-jeans", name: "Sculpted Balloon Jeans", category: "bottoms", source: "production-v2-white" },
  { id: "shoes-party-platform-boots", name: "Party Platform Boots", category: "shoes", source: "production-v2-white" },
];

// Active catalog garments
export const allGarments: Garment[] = garments;

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  tops: 40,
};

// Neutral hands sit above the restored jeans fabric, below the top.
// Showcase poses provide their own arms and omit this neutral overlay.
export const foregroundArmsOrder = 38;

export const bootTuckBottomIds = new Set<string>([
  "bottom-blue-jeans",
  "bottom-navy-dots",
  "bottom-gray-maxi",
]);

export function getGarmentLayerOrder(
  item: Garment | { id: string; category: Category },
  selected: Selection,
  isTucked = true,
): number {
  if (
    item.id === "shoes-brown-boots" &&
    selected.bottoms && bootTuckBottomIds.has(selected.bottoms)
  ) {
    return 35;
  }
  // Denim top is tucked into jeans (đóng thùng) by default, or untucked (thả ngoài) if isTucked is false
  if (item.id === "top-fitted-denim" && selected.bottoms === "bottom-sculpted-jeans") {
    return isTucked ? 28 : layerOrder.tops;
  }
  return layerOrder[item.category];
}

export function getUserFaceLayerOrder(selected: Selection, isTucked = true): number {
  const top = allGarments.find((item) => item.category === "tops" && item.id === selected.tops);
  return top ? getGarmentLayerOrder(top, selected, isTucked) - 1 : layerOrder.tops - 1;
}

export const presets: { name: string; selection: Selection }[] = [
  { name: "Denim Sculpture", selection: { tops: "top-fitted-denim", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
  { name: "Soft Contrast", selection: { tops: "top-modal-grommet", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
];

export const assetUrl = (id: string) => publicAsset(`/game/studio/layers/${id}.png`, `${STUDIO_ASSET_VERSION}-${DEPLOY_VERSION}`);
// The supplied neutral cutouts are the canonical artwork in every destination.
// Legacy pose sprites contain the earlier extraction and are intentionally not selected.
export const hasShowcasePose = (selected: Selection, showcase: boolean, hasUserFace = false) => showcase && !hasUserFace &&
  (selected.tops === "top-fitted-denim" || selected.tops === "top-modal-grommet");
export function modelAssetId(selected: Selection, showcase = false, hasUserFace = false) {
  const boots = selected.shoes === "shoes-party-platform-boots" || selected.shoes === "shoes-brown-boots";
  return hasShowcasePose(selected, showcase, hasUserFace) ? (boots ? "model-lower-boots" : "model-lower") : (boots ? "model-boots" : "model");
}

export function modelAssetIds(selected: Selection, showcase = false, hasUserFace = false) {
  const boots = selected.shoes === "shoes-party-platform-boots" || selected.shoes === "shoes-brown-boots";
  if (hasShowcasePose(selected, showcase, hasUserFace)) {
    return [boots ? "model-lower-boots" : "model-lower"];
  }
  return [
    boots ? "model-lower-boots" : "model-lower",
    selected.tops ? "model-dressed-upper" : "model-upper",
  ];
}
export function garmentAssetId(id: string, selected: Selection, showcase = false, hasUserFace = false) {
  if (hasShowcasePose(selected, showcase, hasUserFace) && id === selected.tops) {
    return `${id}-pose`;
  }
  return id;
}
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => publicAsset(`/game/studio/products/${id}.png`, STUDIO_PRODUCT_VERSION);
