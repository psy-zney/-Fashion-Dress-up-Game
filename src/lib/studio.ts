import { DEPLOY_VERSION, publicAsset } from "./public-asset";

export const STAGE = { width: 1024, height: 1536 } as const;
export const STUDIO_ASSET_VERSION = "production-v2-20260913-v19-short-underlay";
// Product art is independently approved and must not change with layer releases.
export const STUDIO_PRODUCT_VERSION = "production-v2-20260913-v14-new-denim";

export const categories = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
  { id: "dresses", label: "Dresses" },
  { id: "accessories", label: "Accessories" },
] as const;

export const wheelCategories = categories.slice(0, 3);
export const extraCategories = categories.slice(3);

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
  "accessory-abstract-denim-hip-scarf": { left: 374, top: 572, width: 313, height: 263 },
  "bottom-front-slit-denim-skort": { left: 358, top: 529, width: 327, height: 299 },
  "bottom-inside-out-cuff-jeans": { left: 376, top: 527, width: 293, height: 796 },
  "bottom-three-tone-wide-leg-jeans": { left: 345, top: 549, width: 355, height: 867 },
  "dress-strapless-deep-fold-denim": { left: 309, top: 339, width: 423, height: 859 },
  "legwear-pocket-denim-warmers": { left: 378, top: 994, width: 284, height: 316 },
  "top-asymmetric-gradient-denim-shirt": { left: 312, top: 244, width: 422, height: 474 },
  "top-oversized-mint-zip-tank": { left: 376, top: 271, width: 292, height: 458 },
};

export const garments: Garment[] = [
  { id: "top-fitted-denim", name: "Fitted Denim Top", category: "tops", source: "production-v2-white" },
  { id: "top-modal-grommet", name: "Modal Grommet Top", category: "tops", source: "production-v2-red-stitching" },
  { id: "bottom-sculpted-jeans", name: "Sculpted Balloon Jeans", category: "bottoms", source: "production-v2-white" },
  { id: "shoes-party-platform-boots", name: "Party Platform Boots", category: "shoes", source: "production-v2-white" },
  { id: "top-asymmetric-gradient-denim-shirt", name: "Asymmetric Gradient Denim Shirt", category: "tops", source: "reference-20260913" },
  { id: "top-oversized-mint-zip-tank", name: "Oversized Mint Zip Tank", category: "tops", source: "reference-20260913" },
  { id: "bottom-three-tone-wide-leg-jeans", name: "Three-Tone Wide-Leg Jeans", category: "bottoms", source: "reference-20260913" },
  { id: "bottom-inside-out-cuff-jeans", name: "Inside-Out Cuff Jeans", category: "bottoms", source: "reference-20260913" },
  { id: "bottom-front-slit-denim-skort", name: "Front-Slit Denim Skort", category: "bottoms", source: "reference-20260913" },
  { id: "legwear-pocket-denim-warmers", name: "Pocket Denim Leg Warmers", category: "shoes", source: "reference-20260913" },
  { id: "dress-strapless-deep-fold-denim", name: "Strapless Deep-Fold Denim Dress", category: "dresses", source: "reference-20260913" },
  { id: "accessory-abstract-denim-hip-scarf", name: "Abstract Denim Hip Scarf", category: "accessories", source: "reference-20260913" },
];

// Active catalog garments
export const allGarments: Garment[] = garments;

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  dresses: 32,
  tops: 40,
  accessories: 45,
};

export const faceFrameOrder = 43;
export const foregroundHandsOrder = 44;

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
export const hasShowcasePose = (selected: Selection, showcase: boolean, _hasUserFace = false) => showcase &&
  (selected.tops === "top-fitted-denim" || selected.tops === "top-modal-grommet");
export function modelAssetIds(selected: Selection, showcase = false, hasUserFace = false) {
  const boots = selected.shoes === "shoes-party-platform-boots" || selected.shoes === "shoes-brown-boots";
  if (hasShowcasePose(selected, showcase, hasUserFace)) {
    return [boots ? "model-lower-boots" : "model-lower"];
  }
  return [
    boots ? "model-lower-boots" : "model-lower",
    selected.tops || selected.dresses ? "model-dressed-upper" : "model-upper",
  ];
}
export function garmentAssetId(id: string, selected: Selection, showcase = false, hasUserFace = false) {
  if (hasShowcasePose(selected, showcase, hasUserFace) && id === selected.tops) {
    return hasUserFace ? id + "-pose-swap" : id + "-pose";
  }
  return id;
}
export function foregroundHandsAssetId(selected: Selection, showcase = false, hasUserFace = false) {
  return hasShowcasePose(selected, showcase, hasUserFace) && hasUserFace && selected.tops
    ? selected.tops + "-pose-hands"
    : undefined;
}
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => publicAsset(`/game/studio/products/${id}.png`, STUDIO_PRODUCT_VERSION);
