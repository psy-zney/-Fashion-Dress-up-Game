import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const STAGE = { width: 1024, height: 1536 };
const SOURCE = "assets/studio/user-cutouts/2026-09-13-face-compose-v1/original/model-face-frame-overlay.png";
const RELEASE = "artifacts/studio/candidates/2026-09-13-face-compose-v1";
const TRANSPARENT_SOURCE = path.join(RELEASE, "sources/model-face-frame-transparent.png");
const STAGE_OVERLAY = path.join(RELEASE, "layers/model-face-frame-overlay.png");

function pixelLuma(data, width, channels, x, y) {
  const offset = (y * width + x) * channels;
  return Math.round(data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722);
}

function checkerAlpha(data, info, x, y) {
  const offset = (y * info.width + x) * info.channels;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const luma = pixelLuma(data, info.width, info.channels, x, y);

  // The supplied PNG contains a rendered checkerboard rather than alpha. Its
  // cells alternate about every eight pixels. Compare same-axis neighbours to
  // detect that periodic contrast while retaining the smooth white cap.
  const deltas = [];
  let neutralNeighbours = 0;
  for (const [dx, dy] of [[-9, 0], [9, 0], [0, -9], [0, 9]]) {
    const nx = Math.max(0, Math.min(info.width - 1, x + dx));
    const ny = Math.max(0, Math.min(info.height - 1, y + dy));
    const neighbourOffset = (ny * info.width + nx) * info.channels;
    const nr = data[neighbourOffset];
    const ng = data[neighbourOffset + 1];
    const nb = data[neighbourOffset + 2];
    if (Math.max(nr, ng, nb) - Math.min(nr, ng, nb) <= 14) neutralNeighbours += 1;
    deltas.push(Math.abs(pixelLuma(data, info.width, info.channels, nx, ny) - luma));
  }
  deltas.sort((a, b) => b - a);
  const checkerContrast = (deltas[0] + deltas[1]) / 2;
  const isChecker = chroma <= 12 && luma >= 174 && neutralNeighbours >= 3 && checkerContrast >= 24;
  if (isChecker) return 0;

  // Softly suppress compressed checkerboard transition pixels. Saturated hair,
  // glasses, earrings and the green cap button always remain fully opaque.
  if (chroma <= 16 && luma >= 174 && neutralNeighbours >= 3 && checkerContrast > 14) {
    return Math.max(0, Math.min(255, Math.round(255 * (1 - (checkerContrast - 14) / 10))));
  }
  return 255;
}

async function build() {
  const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1199 || info.height !== 1312 || info.channels < 3) {
    throw new Error(`Unexpected face-frame source: ${info.width}x${info.height}, ${info.channels} channels`);
  }

  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceOffset = (y * info.width + x) * info.channels;
      const targetOffset = (y * info.width + x) * 4;
      rgba[targetOffset] = data[sourceOffset];
      rgba[targetOffset + 1] = data[sourceOffset + 1];
      rgba[targetOffset + 2] = data[sourceOffset + 2];
      rgba[targetOffset + 3] = checkerAlpha(data, info, x, y);
    }
  }

  await fs.mkdir(path.dirname(TRANSPARENT_SOURCE), { recursive: true });
  await fs.mkdir(path.dirname(STAGE_OVERLAY), { recursive: true });
  await fs.mkdir(path.join(RELEASE, "qa"), { recursive: true });

  const transparent = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
  await sharp(transparent).toFile(TRANSPARENT_SOURCE);

  const targetHeight = 266;
  const targetWidth = Math.round(info.width * targetHeight / info.height);
  const left = Math.round((STAGE.width - targetWidth) / 2);
  const top = 8;
  const resized = await sharp(transparent).resize(targetWidth, targetHeight).png().toBuffer();
  const stageOverlay = await sharp({
    create: {
      width: STAGE.width,
      height: STAGE.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: resized, left, top }]).png().toBuffer();
  await sharp(stageOverlay).toFile(STAGE_OVERLAY);

  for (const [name, background] of [
    ["white", "#ffffff"],
    ["charcoal", "#202725"],
    ["mint", "#9ff3d2"],
    ["magenta", "#e54a9b"],
  ]) {
    await sharp(stageOverlay)
      .flatten({ background })
      .resize({ width: 512 })
      .png()
      .toFile(path.join(RELEASE, `qa/model-face-frame-overlay-${name}.png`));
  }

  console.log(JSON.stringify({ source: SOURCE, transparent: TRANSPARENT_SOURCE, layer: STAGE_OVERLAY, left, top, targetWidth, targetHeight }, null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
