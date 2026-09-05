export type Screen = 1 | 2 | 3 | 4 | 5;
export type LookScreen = Exclude<Screen, 1>;

export function isScreen(value: number): value is Screen {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export const looks = {
  2: { nodeId: "2:3", name: "Vanilla dress", asset: "look-2.png", x: 231, y: 96, width: 333, height: 887, crop: { width: "220.36%", height: "109.54%", left: "0%", top: "-9.54%" } },
  3: { nodeId: "2:69", name: "Leopard streetwear", asset: "look-3.png", x: 263, y: 96, width: 290, height: 839, crop: { width: "216.93%", height: "100.04%", left: "0%", top: "-0.02%" } },
  4: { nodeId: "2:104", name: "Pop art outfit", asset: "look-4.png", x: 221, y: 25, width: 390, height: 913, crop: { width: "156.16%", height: "100%", left: "-32.27%", top: "0%" } },
  5: { nodeId: "2:126", name: "Toxic mode pink", asset: "look-5.png", x: 263, y: 76, width: 348, height: 898, crop: { width: "212.1%", height: "109.05%", left: "-98.45%", top: "-9.05%" } },
} as const;

export const outfitCards = [
  { screen: 3, asset: "outfits-a.png", crop: { width: "254.66%", height: "258.07%", left: "-18.19%", top: "-37.29%" } },
  { screen: 4, asset: "outfits-a.png", crop: { width: "289.6%", height: "293.48%", left: "-162.69%", top: "-39.54%" } },
  { screen: 2, asset: "outfits-b.png", crop: { width: "279.58%", height: "281.88%", left: "-13.34%", top: "-67.69%" } },
  { screen: 5, asset: "outfits-b.png", crop: { width: "240.14%", height: "242.11%", left: "-115.05%", top: "-48.09%" } },
] as const;

// The original Frame 8 repeats the last two cards in its third row.
export const wardrobeCards = [...outfitCards, outfitCards[2], outfitCards[3]];
