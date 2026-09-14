import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RELEASE = "artifacts/studio/candidates/2026-09-13-face-compose-v1";
const LAYERS = path.join(RELEASE, "layers");
const QA = path.join(RELEASE, "qa");
const STAGE = { width: 1024, height: 1536 };

async function assertLayer(file) {
  const image = sharp(file);
  const metadata = await image.metadata();
  if (metadata.width !== STAGE.width || metadata.height !== STAGE.height || !metadata.hasAlpha) {
    throw new Error(file + " must be a 1024x1536 RGBA PNG");
  }
  const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  let transparent = 0;
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] === 0) transparent += 1;
    else visible += 1;
  }
  if (visible < 500 || transparent < 1_000_000) {
    throw new Error(file + " has suspicious alpha coverage");
  }
}

async function sampleFaceLayer() {
  const face = await sharp("public/game/studio/layers/model-upper.png")
    .extract({ left: 452, top: 96, width: 120, height: 160 })
    .png()
    .toBuffer();
  const mask = Buffer.from('<svg width="120" height="160"><ellipse cx="60" cy="80" rx="58" ry="78" fill="white"/></svg>');
  const clipped = await sharp(face).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp({ create: { width: STAGE.width, height: STAGE.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: clipped, left: 452, top: 96 }])
    .png()
    .toBuffer();
}

async function render(top, background) {
  const face = await sampleFaceLayer();
  const inputs = [
    "public/game/studio/layers/model-lower-boots.png",
    "public/game/studio/layers/shoes-party-platform-boots.png",
    "public/game/studio/layers/bottom-sculpted-jeans.png",
    face,
    "public/game/studio/layers/" + top + "-pose-swap.png",
    path.join(LAYERS, "model-face-frame-overlay.png"),
    path.join(LAYERS, top + "-pose-hands.png"),
  ];
  return sharp({ create: { width: STAGE.width, height: STAGE.height, channels: 4, background } })
    .composite(inputs.map((input) => ({ input })))
    .png()
    .toBuffer();
}

await fs.mkdir(QA, { recursive: true });
for (const file of [
  path.join(LAYERS, "model-face-frame-overlay.png"),
  path.join(LAYERS, "top-fitted-denim-pose-hands.png"),
  path.join(LAYERS, "top-modal-grommet-pose-hands.png"),
]) await assertLayer(file);

for (const top of ["top-fitted-denim", "top-modal-grommet"]) {
  for (const [name, background] of [
    ["white", { r: 255, g: 255, b: 255, alpha: 1 }],
    ["charcoal", { r: 31, g: 39, b: 37, alpha: 1 }],
  ]) {
    const output = await render(top, background);
    await sharp(output).toFile(path.join(QA, top + "-face-composite-" + name + ".png"));
  }
}

console.log("Face composite candidate QA rendered in " + QA);
