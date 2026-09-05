import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CONFIGS, INTERACTIONS, PATHS, STAGE } from "./pipeline.config.mjs";

const MODEL_PATH = path.join(PATHS.runtimeLayers, "model.png");
const READY_DIR = PATHS.runtimeLayers;
const QA_DIR = PATHS.qa;

const LOOKS = [
  {
    name: "look-french-dots",
    title: "Pháp cổ điển (Lace + Navy Dots + Mary Janes)",
    top: "top-white-lace",
    bottom: "bottom-navy-dots",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-autumn-denim",
    title: "Mùa thu năng động (Red Off-shoulder + Blue Jeans + Brown Boots)",
    top: "top-red-offshoulder",
    bottom: "bottom-blue-jeans",
    shoes: "shoes-brown-boots",
  },
  {
    name: "look-monochrome-gray",
    title: "Tối giản thanh lịch (Gray V + Gray Maxi + Mary Janes)",
    top: "top-gray-v",
    bottom: "bottom-gray-maxi",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-casual-summer",
    title: "Mùa hè phóng khoáng (Black Tee + White Shorts + Mary Janes)",
    top: "top-black-tee",
    bottom: "bottom-white-shorts",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-romantic-pleats",
    title: "Ren & Xếp ly (Ivory Pointelle + White Pleats + Brown Boots)",
    top: "top-ivory-pointelle",
    bottom: "bottom-white-pleats",
    shoes: "shoes-brown-boots",
  },
  {
    name: "look-minimalist-chic",
    title: "Hiện đại quyến rũ (White Basic + Black Mini + Mary Janes)",
    top: "top-white-basic",
    bottom: "bottom-black-mini",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-navy-boots",
    title: "Navy phối boots cao (giữ nguyên gấu váy)",
    top: "top-white-basic",
    bottom: "bottom-navy-dots",
    shoes: "shoes-brown-boots",
  },
  {
    name: "look-gray-boots",
    title: "Váy xám phối boots cao (giữ nguyên gấu váy)",
    top: "top-white-lace",
    bottom: "bottom-gray-maxi",
    shoes: "shoes-brown-boots",
  },
];

async function run() {
  await fs.mkdir(QA_DIR, { recursive: true });

  // 1. Render acceptance looks, including risky tall-boot combinations.
  for (const look of LOOKS) {
    const shoes = { input: path.join(READY_DIR, `${look.shoes}.png`) };
    let bottom = { input: path.join(READY_DIR, `${look.bottom}.png`) };
    const shouldShortenForBoots =
      look.shoes === INTERACTIONS.tallBootId && INTERACTIONS.longBottomIds.includes(look.bottom);
    if (shouldShortenForBoots) {
      const clippedHeight = Math.round(STAGE.height * INTERACTIONS.tallBootClipRatio);
      const tuckedJeans = await sharp(bottom.input)
        .extract({ left: 0, top: 0, width: STAGE.width, height: clippedHeight })
        .extend({
          bottom: STAGE.height - clippedHeight,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      bottom = { input: tuckedJeans };
    }
    const top = { input: path.join(READY_DIR, `${look.top}.png`) };
    const layers = shouldShortenForBoots
      ? [bottom, shoes, top]
      : [shoes, bottom, top];

    const outPath = path.join(QA_DIR, `${look.name}.png`);
    await sharp(look.shoes === INTERACTIONS.tallBootId ? path.join(READY_DIR, "model-boots.png") : MODEL_PATH)
      .composite(layers)
      .png()
      .toFile(outPath);
    console.log(`Rendered look: ${look.title} -> ${outPath}`);
  }

  // 2. Generate a contact sheet directly from the canonical catalog.
  const items = Object.keys(CONFIGS);

  const cellWidth = 256;
  const cellHeight = 384;
  const cols = 5;
  const rows = Math.ceil(items.length / cols);
  const sheetWidth = cols * cellWidth;
  const sheetHeight = rows * cellHeight;

  const composites = [];
  for (let i = 0; i < items.length; i++) {
    const id = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const full = await sharp(id === INTERACTIONS.tallBootId ? path.join(READY_DIR, "model-boots.png") : MODEL_PATH)
      .composite([{ input: path.join(READY_DIR, `${id}.png`) }])
      .png()
      .toBuffer();

    const thumb = await sharp(full)
      .resize(cellWidth, cellHeight)
      .png()
      .toBuffer();

    composites.push({
      input: thumb,
      left: col * cellWidth,
      top: row * cellHeight,
    });
  }

  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 251, g: 252, b: 247, alpha: 1 },
    },
  })
    .composite(composites.map(c => ({ input: c.input, left: c.left, top: c.top })))
    .png()
    .toFile(path.join(QA_DIR, "contact-sheet-14-items.png"));

  console.log("Rendered contact sheet: artifacts/studio-qa/assets/contact-sheet-14-items.png");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
