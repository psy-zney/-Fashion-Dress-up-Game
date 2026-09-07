import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CONFIGS, INTERACTIONS, PATHS, STAGE } from "./pipeline.config.mjs";

const MODEL_PATH = path.join(PATHS.runtimeLayers, "model.png");
const READY_DIR = PATHS.runtimeLayers;
const QA_DIR = PATHS.qa;

const LOOKS = [
  {
    name: "look-fitted-denim-maxi",
    title: "Denim ráp khối (Fitted Denim + Sculpted Maxi + Mary Janes)",
    top: "top-fitted-denim",
    bottom: "bottom-denim-sculpted-skirt",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-modal-balloon",
    title: "Tương phản mềm (Modal Grommet + Sculpted Jeans + Mary Janes)",
    top: "top-modal-grommet",
    bottom: "bottom-sculpted-jeans",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-fitted-denim-balloon",
    title: "Denim toàn bộ (Fitted Denim + Sculpted Jeans + Mary Janes)",
    top: "top-fitted-denim",
    bottom: "bottom-sculpted-jeans",
    shoes: "shoes-mary-janes",
  },
  {
    name: "look-modal-maxi",
    title: "Modal & denim dài (Modal Grommet + Sculpted Maxi + Mary Janes)",
    top: "top-modal-grommet",
    bottom: "bottom-denim-sculpted-skirt",
    shoes: "shoes-mary-janes",
  },
];

async function run() {
  await fs.mkdir(QA_DIR, { recursive: true });
  const { foregroundArmsPath } = JSON.parse(await fs.readFile("src/lib/studio-geometry.json", "utf8"));
  const armsMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE.width}" height="${STAGE.height}"><path fill="white" d="${foregroundArmsPath}"/></svg>`);
  const arms = { input: await sharp(MODEL_PATH).composite([{ input: armsMask, blend: "dest-in" }]).png().toBuffer() };

  // 1. Render every top/bottom combination in the active capsule.
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
      ? [bottom, shoes, arms, top]
      : [shoes, bottom, arms, top];

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
    .toFile(path.join(QA_DIR, "contact-sheet-5-items.png"));

  console.log("Rendered contact sheet: artifacts/studio/qa/assets/contact-sheet-5-items.png");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
