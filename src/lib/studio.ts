export const STAGE = { width: 1024, height: 1536 } as const;
export const STUDIO_ASSET_VERSION = "production-v2-20260909-v9-source-recut";

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
): number {
  if (
    item.id === "shoes-brown-boots" &&
    selected.bottoms && bootTuckBottomIds.has(selected.bottoms)
  ) {
    return 35;
  }
  // Denim top is tucked into jeans (đóng thùng)
  if (item.id === "top-fitted-denim" && selected.bottoms === "bottom-sculpted-jeans") {
    return 28;
  }
  return layerOrder[item.category];
}

export const presets: { name: string; selection: Selection }[] = [
  { name: "Denim Sculpture", selection: { tops: "top-fitted-denim", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
  { name: "Soft Contrast", selection: { tops: "top-modal-grommet", bottoms: "bottom-sculpted-jeans", shoes: "shoes-party-platform-boots" } },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const assetUrl = (id: string) => `${basePath}/game/studio/layers/${id}.png?v=${STUDIO_ASSET_VERSION}`;
export const hasShowcasePose = (selected: Selection, showcase: boolean) => showcase &&
  (selected.tops === "top-fitted-denim" || selected.tops === "top-modal-grommet");
export function modelAssetId(selected: Selection, showcase = false) {
  const boots = selected.shoes === "shoes-party-platform-boots" || selected.shoes === "shoes-brown-boots";
  return hasShowcasePose(selected, showcase) ? (boots ? "model-lower-boots" : "model-lower") : (boots ? "model-boots" : "model");
}
export const garmentAssetId = (id: string, selected: Selection, showcase = false) =>
  hasShowcasePose(selected, showcase) && id === selected.tops ? `${id}-pose` : id;
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => `${basePath}/game/studio/products/${id}.png?v=${STUDIO_ASSET_VERSION}`;
