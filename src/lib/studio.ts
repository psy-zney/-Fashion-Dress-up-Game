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
  // 8 Tops
  { id: "top-fitted-denim", name: "Fitted Denim Top", category: "tops", source: "generated-top-fitted-denim-v3" },
  { id: "top-modal-grommet", name: "Modal Grommet Top", category: "tops", source: "generated-top-modal-grommet-v3" },
  { id: "top-white-basic", name: "Basic White Cami", category: "tops", source: "worn-top-white-basic" },
  { id: "top-black-tee", name: "Black T-Shirt", category: "tops", source: "worn-top-black-tee" },
  { id: "top-white-lace", name: "White Lace Long Sleeve", category: "tops", source: "worn-top-white-lace" },
  { id: "top-gray-v", name: "Gray V-Neck Knit", category: "tops", source: "worn-top-gray-v" },
  { id: "top-ivory-pointelle", name: "Cream Pointelle Knit", category: "tops", source: "worn-top-ivory-pointelle" },
  { id: "top-red-offshoulder", name: "Red Off-Shoulder Top", category: "tops", source: "worn-top-red-offshoulder" },

  // 8 Bottoms
  { id: "bottom-sculpted-jeans", name: "Sculpted Balloon Jeans", category: "bottoms", source: "generated-bottom-sculpted-jeans-v1" },
  { id: "bottom-denim-sculpted-skirt", name: "Sculpted Denim Maxi Skirt", category: "bottoms", source: "generated-bottom-denim-sculpted-skirt-v5" },
  { id: "bottom-blue-jeans", name: "Classic Blue Jeans", category: "bottoms", source: "worn-bottom-blue-jeans" },
  { id: "bottom-white-shorts", name: "White Denim Shorts", category: "bottoms", source: "worn-bottom-white-shorts" },
  { id: "bottom-black-mini", name: "Black Mini Skirt", category: "bottoms", source: "worn-bottom-black-mini" },
  { id: "bottom-navy-dots", name: "Navy Polka Dot Skirt", category: "bottoms", source: "worn-bottom-navy-dots" },
  { id: "bottom-white-pleats", name: "White Pleated Lace Skirt", category: "bottoms", source: "worn-bottom-white-pleats" },
  { id: "bottom-gray-maxi", name: "Gray Pleated Maxi Skirt", category: "bottoms", source: "worn-bottom-gray-maxi" },

  // 1 Shoes (excluding brown boots as requested)
  { id: "shoes-mary-janes", name: "Black Mary Janes", category: "shoes", source: "worn-shoes-mary-janes" },
];

// Export all known garments so saved looks and photoshoot composition preserve
// legacy/alternative items like shoes-brown-boots.
export const allGarments: Garment[] = [
  ...garments,
  { id: "shoes-brown-boots", name: "Brown Knee-High Boots", category: "shoes", source: "fitted-shoes-brown-boots" },
];

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  tops: 40,
};

// Only the forearms/hands: keep the model's real hands in front of every
// bottom, while sleeves (tops, z40) can still cover the arms naturally.
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
export const assetUrl = (id: string) => `${basePath}/game/studio/layers/${id}.png?v=2.2`;
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => `${basePath}/game/studio/products/${id}.png`;
