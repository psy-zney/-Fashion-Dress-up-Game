export const STAGE = { width: 1024, height: 1536 } as const;

export const categories = [
  { id: "tops", label: "Áo" },
  { id: "bottoms", label: "Quần & váy" },
  { id: "shoes", label: "Giày" },
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
  // 6 TOPS
  { id: "top-white-basic", name: "Áo hai dây trắng basic", category: "tops", source: "worn-top-white-basic" },
  { id: "top-black-tee", name: "Áo thun đen", category: "tops", source: "worn-top-black-tee" },
  { id: "top-white-lace", name: "Áo trắng dài tay viền ren", category: "tops", source: "worn-top-white-lace" },
  { id: "top-gray-v", name: "Áo len xám cổ V", category: "tops", source: "worn-top-gray-v" },
  { id: "top-ivory-pointelle", name: "Áo dệt kim kem", category: "tops", source: "worn-top-ivory-pointelle" },
  { id: "top-red-offshoulder", name: "Áo đỏ trễ vai tay loe", category: "tops", source: "worn-top-red-offshoulder" },

  // 6 BOTTOMS
  { id: "bottom-blue-jeans", name: "Quần jeans xanh", category: "bottoms", source: "worn-bottom-blue-jeans" },
  { id: "bottom-white-shorts", name: "Quần short trắng", category: "bottoms", source: "worn-bottom-white-shorts" },
  { id: "bottom-black-mini", name: "Váy ngắn đen", category: "bottoms", source: "worn-bottom-black-mini" },
  { id: "bottom-navy-dots", name: "Váy navy chấm bi", category: "bottoms", source: "worn-bottom-navy-dots" },
  { id: "bottom-white-pleats", name: "Váy xếp ly trắng viền ren", category: "bottoms", source: "worn-bottom-white-pleats" },
  { id: "bottom-gray-maxi", name: "Váy dài xếp ly xám", category: "bottoms", source: "worn-bottom-gray-maxi" },

  // 2 SHOES
  { id: "shoes-mary-janes", name: "Giày Mary Jane đen", category: "shoes", source: "worn-shoes-mary-janes" },
  { id: "shoes-brown-boots", name: "Boots nâu cao cổ", category: "shoes", source: "fitted-shoes-brown-boots" },
];

export const layerOrder: Record<Category, number> = {
  shoes: 20,
  bottoms: 30,
  tops: 40,
};

export const longBottomIds = new Set([
  "bottom-blue-jeans",
  "bottom-navy-dots",
  "bottom-gray-maxi",
]);

export const presets: { name: string; selection: Selection }[] = [
  { name: "Pháp cổ điển", selection: { tops: "top-white-basic", bottoms: "bottom-navy-dots", shoes: "shoes-mary-janes" } },
  { name: "Ngày thu năng động", selection: { tops: "top-red-offshoulder", bottoms: "bottom-blue-jeans", shoes: "shoes-brown-boots" } },
  { name: "Xếp ly lãng mạn", selection: { tops: "top-ivory-pointelle", bottoms: "bottom-white-pleats", shoes: "shoes-mary-janes" } },
  { name: "Mùa hè năng động", selection: { tops: "top-black-tee", bottoms: "bottom-white-shorts", shoes: "shoes-mary-janes" } },
  { name: "Thanh lịch tối giản", selection: { tops: "top-gray-v", bottoms: "bottom-gray-maxi", shoes: "shoes-brown-boots" } },
  { name: "Ren đen hiện đại", selection: { tops: "top-white-lace", bottoms: "bottom-black-mini", shoes: "shoes-mary-janes" } },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const assetUrl = (id: string) => `${basePath}/game/studio/layers/${id}.png`;
// Reviewed product cutouts have real alpha; the card and pointer sticker share
// this URL. Never substitute body-aligned sprite masks or opaque source renders.
export const previewAssetUrl = (id: string) => `${basePath}/game/studio/products-v2/${id}.png`;
