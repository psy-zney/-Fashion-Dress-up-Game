import { DEPLOY_VERSION, publicAsset } from "./public-asset";

export const STAGE = { width: 1024, height: 1536 } as const;
export const STUDIO_ASSET_VERSION = "production-v2-20260915-v24-isolated-swap-branches";
// Product art is independently approved and must not change with layer releases.
export const STUDIO_PRODUCT_VERSION = "production-v2-20260914-v15-party-boots-angle";

export const categories = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
] as const;

export const wheelCategories = categories;
export const extraCategories: readonly { id: string; label: string }[] = [];

export type Category = (typeof categories)[number]["id"];
export type Selection = {
  tops?: string;
  bottoms?: string;
  shoes?: string;
  accessories?: string | string[];
} & Partial<Record<Category, any>>;

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
  "shoes-mint-studded-wedge-sneakers": { left: 414, top: 1302, width: 210, height: 202 },
  "shoes-aqua-wrap-strap-wedge-sneakers": { left: 411, top: 1270, width: 216, height: 232 },
  "shoes-pink-aqua-striped-platform-high-tops": { left: 410, top: 1281, width: 222, height: 209 },
  "shoes-aqua-coral-wedge-high-tops": { left: 416, top: 1301, width: 211, height: 193 },
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
  { id: "shoes-mint-studded-wedge-sneakers", name: "Mint Studded Wedge Sneakers", category: "shoes", source: "reference-20260914" },
  { id: "shoes-aqua-wrap-strap-wedge-sneakers", name: "Aqua Wrap-Strap Wedge Sneakers", category: "shoes", source: "reference-20260914" },
  { id: "shoes-pink-aqua-striped-platform-high-tops", name: "Pink–Aqua Striped Platform High-Tops", category: "shoes", source: "reference-20260914" },
  { id: "shoes-aqua-coral-wedge-high-tops", name: "Aqua–Coral Wedge High-Tops", category: "shoes", source: "reference-20260914" },
  { id: "top-asymmetric-gradient-denim-shirt", name: "Asymmetric Gradient Denim Shirt", category: "tops", source: "reference-20260913" },
  { id: "top-oversized-mint-zip-tank", name: "Oversized Mint Zip Tank", category: "tops", source: "reference-20260913" },
  { id: "bottom-three-tone-wide-leg-jeans", name: "Three-Tone Wide-Leg Jeans", category: "bottoms", source: "reference-20260913" },
  { id: "bottom-inside-out-cuff-jeans", name: "Inside-Out Cuff Jeans", category: "bottoms", source: "reference-20260913" },
  { id: "bottom-front-slit-denim-skort", name: "Front-Slit Denim Skort", category: "bottoms", source: "reference-20260913" },
  { id: "legwear-pocket-denim-warmers", name: "Pocket Denim Leg Warmers", category: "accessories", source: "reference-20260913" },
  { id: "dress-strapless-deep-fold-denim", name: "Strapless Deep-Fold Denim Dress", category: "tops", source: "reference-20260913" },
  { id: "accessory-abstract-denim-hip-scarf", name: "Abstract Denim Hip Scarf", category: "accessories", source: "reference-20260913" },
];

// Active catalog garments
export const allGarments: Garment[] = garments;

export function isGarmentSelected(id: string, selected: Selection): boolean {
  const item = allGarments.find((candidate) => candidate.id === id);
  if (!item) return false;
  if (item.category === "accessories") {
    if (Array.isArray(selected.accessories)) {
      return selected.accessories.includes(id);
    }
    return selected.accessories === id;
  }
  return selected[item.category] === id;
}

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  tops: 40,
  accessories: 45,
};

// Denim legwear must cover the shafts of these shoes. Keep them immediately
// below the legwear (25), while bottoms remain above both at 30+.
export const highShaftShoeIds = new Set<string>([
  "shoes-party-platform-boots",
  "shoes-pink-aqua-striped-platform-high-tops",
  "shoes-aqua-coral-wedge-high-tops",
]);
export const highShaftShoeOrder = 24;

export const faceFrameOrder = 43;

// The special dress pose is intentionally split into three registered canvases.
// Keep these values adjacent and below normal garment orders so the relationship
// cannot be reversed by an unrelated wardrobe z-index change:
//   complete pose (0) -> high-shaft shoes (1) -> denim legwear (2)
//   -> legless pose cover (3).
export const showcasePoseLayerOrder = {
  base: 0,
  shoes: 1,
  legwear: 2,
  cover: 3,
} as const;
export const showcasePoseCoverOrder = showcasePoseLayerOrder.cover;

// Tuck support is garment metadata rather than a one-off UI special case. The
// admin can override this list for the current browser session and live-preview
// the same rule in the game.
export const DEFAULT_TUCKABLE_TOP_IDS = ["top-fitted-denim"] as const;

export function canTuckTop(id: string | undefined, tuckableTopIds: readonly string[] = DEFAULT_TUCKABLE_TOP_IDS): boolean {
  return Boolean(id && tuckableTopIds.includes(id));
}

export const bootTuckBottomIds = new Set<string>([
  "bottom-blue-jeans",
  "bottom-navy-dots",
  "bottom-gray-maxi",
]);

export function getGarmentLayerOrder(
  item: Garment | { id: string; category: Category },
  selected: Selection,
  isTucked = true,
  tuckableTopIds: readonly string[] = DEFAULT_TUCKABLE_TOP_IDS,
  isShowcase = false,
  hasUserFace = false,
): number {
  // In the plain special-dress showcase, high-shaft shoes stay behind the
  // denim legwear, and both are sandwiched between the complete pose and its
  // legless cover. Face swap returns to the regular standing-model orders.
  if (
    isShowcase &&
    !hasUserFace &&
    selected.tops === "dress-strapless-deep-fold-denim" &&
    isGarmentSelected("legwear-pocket-denim-warmers", selected) &&
    item.category === "shoes" &&
    highShaftShoeIds.has(item.id)
  ) {
    return showcasePoseLayerOrder.shoes;
  }
  if (
    isShowcase &&
    !hasUserFace &&
    selected.tops === "dress-strapless-deep-fold-denim" &&
    item.id === "legwear-pocket-denim-warmers"
  ) {
    return showcasePoseLayerOrder.legwear;
  }
  if (
    item.id === "shoes-brown-boots" &&
    selected.bottoms && bootTuckBottomIds.has(selected.bottoms)
  ) {
    return 35;
  }
  if (
    item.category === "shoes" &&
    highShaftShoeIds.has(item.id) &&
    isGarmentSelected("legwear-pocket-denim-warmers", selected)
  ) {
    return highShaftShoeOrder;
  }
  // A top marked as tuckable moves below the selected bottom only while tucked.
  if (item.id === selected.tops && selected.bottoms && canTuckTop(item.id, tuckableTopIds)) {
    return isTucked ? 28 : layerOrder.tops;
  }
  if (item.id === "legwear-pocket-denim-warmers") {
    return 25;
  }
  if (item.id === "accessory-abstract-denim-hip-scarf") {
    return 42;
  }
  return layerOrder[item.category];
}

export function getUserFaceLayerOrder(
  selected: Selection,
  isTucked = true,
  tuckableTopIds: readonly string[] = DEFAULT_TUCKABLE_TOP_IDS,
): number {
  const top = allGarments.find((item) => item.category === "tops" && item.id === selected.tops);
  return top ? getGarmentLayerOrder(top, selected, isTucked, tuckableTopIds) - 1 : layerOrder.tops - 1;
}

export const presets: { name: string; selection: Selection }[] = [
  { name: "Denim Sculpture", selection: { tops: "top-fitted-denim", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
  { name: "Soft Contrast", selection: { tops: "top-modal-grommet", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
];

export const POSE_TOPS: Record<string, string> = {
  "top-fitted-denim": "top-fitted-denim-pose",
  "top-modal-grommet": "top-modal-grommet-pose",
  "top-oversized-mint-zip-tank": "top-oversized-mint-zip-tank-pose",
  "top-asymmetric-gradient-denim-shirt": "top-asymmetric-gradient-denim-shirt-pose",
  "dress-strapless-deep-fold-denim": "dress-strapless-deep-fold-denim-pose",
};

// Face-swap pose artwork is the default for regular tops. The special denim
// dress is intentionally absent: it alone returns to the standing model.
export const SWAP_TOPS: Record<string, string> = {
  "top-fitted-denim": "top-fitted-denim-pose-swap",
  "top-modal-grommet": "top-modal-grommet-pose-swap",
  "top-oversized-mint-zip-tank": "top-oversized-mint-zip-tank-pose",
  "top-asymmetric-gradient-denim-shirt": "top-asymmetric-gradient-denim-shirt-pose",
};

export function isGarmentVisibleInStage(
  item: Garment | { id: string; category: Category },
  selected: Selection,
  showcase = false,
  faceSwapLayoutActive = false,
): boolean {
  if (showcase && selected.tops === "dress-strapless-deep-fold-denim") {
    // Face-swap: dress garment must render on top of the regular model; shoes/accessories too.
    if (faceSwapLayoutActive) return item.category === "tops" || item.category === "shoes" || item.category === "accessories";
    // Plain showcase: dress artwork is already in the pose image — only show shoes/accessories.
    return item.category === "shoes" || item.category === "accessories";
  }
  return true;
}

// Legless copy of the special pose. It hides the upper half of denim legwear,
// while the complete pose below supplies the real legs. This cover must never
// render during face swap because that branch uses the standing model.
export const SHOWCASE_POSE_COVERS: Record<string, string> = {
  "dress-strapless-deep-fold-denim": "dress-strapless-deep-fold-denim-pose-fg",
};

export function showcasePoseCoverAssetId(
  selected: Selection,
  showcase = false,
  hasUserFace = false,
): string | null {
  if (
    !showcase ||
    hasUserFace ||
    !selected.tops ||
    !isGarmentSelected("legwear-pocket-denim-warmers", selected)
  ) return null;
  return SHOWCASE_POSE_COVERS[selected.tops] ?? null;
}

export function getLayerSubfolder(id: string): "model" | "tops" | "bottoms" | "shoes" | "accessories" | "showYouLook" {
  if (id.includes("-pose")) return "showYouLook";
  if (id.startsWith("model-")) return "model";
  if (id.startsWith("top-") || id.startsWith("dress-")) return "tops";
  if (id.startsWith("bottom-")) return "bottoms";
  if (id.startsWith("shoes-")) return "shoes";
  if (id.startsWith("legwear-") || id.startsWith("accessory-")) return "accessories";
  return "model";
}

export const assetUrl = (id: string) =>
  publicAsset(`/game/studio/layers/${getLayerSubfolder(id)}/${id}.png`, `${STUDIO_ASSET_VERSION}-${DEPLOY_VERSION}`);
// One complete registered model is used in each pose. The shoe variants keep the
// calves and ankles, removing only the feet hidden behind shoe artwork.
export const hasShowcasePose = (_selected: Selection, showcase: boolean, _hasUserFace = false) => showcase;
export function modelAssetIds(selected: Selection, showcase = false, faceSwapLayoutActive = false) {
  if (
    showcase &&
    faceSwapLayoutActive &&
    selected.tops === "dress-strapless-deep-fold-denim"
  ) {
    const suffix = selected.shoes ? "-shoes" : "";
    return [`model-neutral${suffix}`];
  }
  if (showcase && selected.tops === "dress-strapless-deep-fold-denim") {
    // Plain showcase keeps the supplied full-body pose image. Face swap has
    // already returned above with the registered standing model.
    return ["dress-strapless-deep-fold-denim-pose"];
  }
  const suffix = selected.shoes ? "-shoes" : "";
  const currentTop = selected.tops;
  const isWearingPoseTop = showcase && Boolean(currentTop && POSE_TOPS[currentTop]);
  return [isWearingPoseTop ? `model-neutral-no-arms${suffix}` : `model-neutral${suffix}`];
}
export function garmentAssetId(id: string, _selected: Selection, showcase = false, faceSwapLayoutActive = false) {
  if (showcase && faceSwapLayoutActive) {
    if (id === "dress-strapless-deep-fold-denim") return id;
    return SWAP_TOPS[id] ?? id;
  }
  if (showcase && POSE_TOPS[id]) {
    return POSE_TOPS[id];
  }
  return id;
}

// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => publicAsset(`/game/studio/products/${id}.png`, STUDIO_PRODUCT_VERSION);
