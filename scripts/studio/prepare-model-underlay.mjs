import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1024;
const HEIGHT = 1536;
const releaseRoot = path.join(
  "assets",
  "studio",
  "user-cutouts",
  "2026-09-13-model-underlay-v1",
);
const alignedRoot = path.join(releaseRoot, "aligned");
const previousReleaseRoot = path.join(
  "assets",
  "studio",
  "user-cutouts",
  "2026-09-11-layer-refresh-v1",
);

const maskInputs = [
  ["model-upper", path.join(previousReleaseRoot, "aligned", "model-upper.png")],
  ["model-lower", path.join(previousReleaseRoot, "aligned", "model-lower.png")],
  ["model-lower-boots", path.join(previousReleaseRoot, "aligned", "model-lower-boots.png")],
];

async function writeAlphaMask(id, inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== WIDTH || info.height !== HEIGHT || info.channels !== 4) {
    throw new Error(`${id}: expected ${WIDTH}x${HEIGHT} RGBA mask source`);
  }

  const mask = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++) {
    const offset = pixel * 4;
    mask[offset] = 255;
    mask[offset + 1] = 255;
    mask[offset + 2] = 255;
    mask[offset + 3] = data[offset + 3];
  }

  await sharp(mask, {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  })
    .png()
    .toFile(path.join(releaseRoot, "masks", `${id}.png`));
}

async function readRgba(inputPath, id) {
  const result = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (result.info.width !== WIDTH || result.info.height !== HEIGHT || result.info.channels !== 4) {
    throw new Error(`${id}: expected ${WIDTH}x${HEIGHT} RGBA input`);
  }
  return result.data;
}

function chromaAlpha(red, green, blue) {
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  return Math.max(0, Math.min(255, Math.round((chroma - 4) * 28)));
}

async function prepareLowerLayers() {
  const source = await readRgba(
    path.join(releaseRoot, "generated", "model-lower-short-checkerboard-source.png"),
    "generated lower",
  );
  const lowerMask = await readRgba(maskInputs[1][1], "model-lower mask source");
  const bootsMask = await readRgba(maskInputs[2][1], "model-lower-boots mask source");
  const lower = Buffer.alloc(source.length);
  const lowerBoots = Buffer.alloc(source.length);

  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++) {
    const offset = pixel * 4;
    const matte = chromaAlpha(source[offset], source[offset + 1], source[offset + 2]);
    for (const [target, maskAlpha] of [
      [lower, lowerMask[offset + 3]],
      [lowerBoots, bootsMask[offset + 3]],
    ]) {
      target[offset] = source[offset];
      target[offset + 1] = source[offset + 1];
      target[offset + 2] = source[offset + 2];
      target[offset + 3] = Math.round((matte * maskAlpha) / 255);
    }
  }

  await Promise.all([
    sharp(lower, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
      .png()
      .toFile(path.join(alignedRoot, "model-lower.png")),
    sharp(lowerBoots, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
      .png()
      .toFile(path.join(alignedRoot, "model-lower-boots.png")),
  ]);
}

async function prepareDressedUpper() {
  const original = await readRgba(maskInputs[0][1], "model-upper");
  const generated = await readRgba(
    path.join(previousReleaseRoot, "generated", "model-dressed-checkerboard-source.png"),
    "generated dressed model",
  );
  const output = Buffer.from(original);

  // Restrict generated RGB to the central bodysuit area. Original head, arms,
  // accessories and antialiased silhouette remain byte-for-byte clean.
  for (let y = 250; y <= 638; y++) {
    for (let x = 388; x <= 656; x++) {
      const offset = (y * WIDTH + x) * 4;
      if (original[offset + 3] === 0) continue;
      const matte = chromaAlpha(generated[offset], generated[offset + 1], generated[offset + 2]);
      if (matte < 192) continue;
      const edgeDistance = Math.min(x - 388, 656 - x, y - 250, 638 - y);
      const weight = Math.max(0, Math.min(1, edgeDistance / 10));
      for (let channel = 0; channel < 3; channel++) {
        output[offset + channel] = Math.round(
          original[offset + channel] * (1 - weight) + generated[offset + channel] * weight,
        );
      }
    }
  }

  await sharp(output, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toFile(path.join(alignedRoot, "model-dressed-upper.png"));
}

async function main() {
  await fs.mkdir(path.join(releaseRoot, "masks"), { recursive: true });
  await fs.mkdir(alignedRoot, { recursive: true });

  const generated = await sharp(
    path.join(releaseRoot, "generated", "model-lower-short-checkerboard-source.png"),
  ).metadata();
  if (generated.width !== WIDTH || generated.height !== HEIGHT) {
    throw new Error(`generated lower: expected ${WIDTH}x${HEIGHT}`);
  }

  await Promise.all(maskInputs.map(([id, inputPath]) => writeAlphaMask(id, inputPath)));
  await Promise.all([prepareLowerLayers(), prepareDressedUpper()]);
  console.log(`Prepared ${maskInputs.length} source-bound masks and 3 aligned model layers in ${releaseRoot}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
