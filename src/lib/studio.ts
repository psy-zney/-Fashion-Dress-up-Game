import geometry from "./studio-geometry.json";

export const STAGE = { width: 1024, height: 1536 } as const;

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
  // Current reviewed capsule: keep the wardrobe focused on the four remade
  // garments while their close-up mobile alpha edges are being approved.
  { id: "top-fitted-denim", name: "Fitted Denim Top", category: "tops", source: "generated-top-fitted-denim-v4" },
  { id: "top-modal-grommet", name: "Modal Grommet Top", category: "tops", source: "generated-top-modal-grommet-v4" },
  { id: "bottom-sculpted-jeans", name: "Sculpted Balloon Jeans", category: "bottoms", source: "generated-bottom-sculpted-jeans-v2" },
  { id: "bottom-denim-sculpted-skirt", name: "Sculpted Denim Maxi Skirt", category: "bottoms", source: "generated-bottom-denim-sculpted-skirt-v6" },

  // One reviewed shoe remains available to complete and photograph a look.
  { id: "shoes-mary-janes", name: "Black Mary Janes", category: "shoes", source: "worn-shoes-mary-janes" },
];

// Active catalog garments
export const allGarments: Garment[] = garments;

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  tops: 40,
};

// The reviewed four-item capsule is extracted from worn sources, so its bottom
// layers already contain exact hand-shaped openings. No broad foreground-arm
// clip is needed; a broad clip would reveal the neutral base garment at hips.
export const foregroundArmsOrder = 38;
export const foregroundArmsPath = geometry.foregroundArmsPath;

export const bootTuckBottomIds = new Set<string>([
  "bottom-blue-jeans",
  "bottom-sculpted-jeans",
  "bottom-navy-dots",
  "bottom-gray-maxi",
  "bottom-denim-sculpted-skirt",
]);

export const presets: { name: string; selection: Selection }[] = [
  { name: "Denim Sculpture", selection: { tops: "top-fitted-denim", bottoms: "bottom-denim-sculpted-skirt", shoes: "shoes-mary-janes" } },
  { name: "Soft Contrast", selection: { tops: "top-modal-grommet", bottoms: "bottom-sculpted-jeans", shoes: "shoes-mary-janes" } },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const assetUrl = (id: string) => `${basePath}/game/studio/layers/${id}.png?v=2.3`;
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => `${basePath}/game/studio/products/${id}.png`;
