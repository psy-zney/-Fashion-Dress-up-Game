import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertProductsUnchanged, projectRoot, sha256 } from "./product-lock.mjs";

const SOURCE = "assets/studio/user-cutouts/2026-09-11-layer-refresh-v1/aligned/model-dressed-upper.png";
const RUNTIME_NAME = "model-face-accessories-safe.png";
const WIDTH = 1024;
const HEIGHT = 1536;

const releaseArg = process.argv.find((value) => value.startsWith("--release="));
const release = releaseArg?.slice("--release=".length);
const install = process.argv.includes("--install");

if (!release || !/^[a-z0-9-]+$/.test(release)) {
  throw new Error("Pass a new release name: --release=face-safe-v1");
}

const releaseRoot = path.join(projectRoot, "artifacts/studio/candidates", release);
const layerDirectory = path.join(releaseRoot, "layers");
const qaDirectory = path.join(releaseRoot, "qa");
const sourcePath = path.join(projectRoot, SOURCE);
const candidatePath = path.join(layerDirectory, RUNTIME_NAME);

await assertProductsUnchanged();
await fs.mkdir(layerDirectory, { recursive: false }).catch((error) => {
  if (error.code === "ENOENT") return fs.mkdir(layerDirectory, { recursive: true });
  throw new Error(`Candidate release already exists: ${releaseRoot}`);
});
await fs.mkdir(qaDirectory, { recursive: true });

const sourceFile = await fs.readFile(sourcePath);
const source = await sharp(sourceFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (source.info.width !== WIDTH || source.info.height !== HEIGHT || source.info.channels !== 4) {
  throw new Error("Face accessory source must be RGBA 1024 x 1536.");
}

const faceMaskSvg = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <path d="M518 142 C548 142 573 151 576 171 C579 194 566 216 550 232 C538 244 526 253 518 257 C510 253 495 244 483 232 C466 216 456 194 460 171 C464 151 488 144 518 142 Z" fill="white"/>
  </svg>
`);
const faceMask = await sharp(faceMaskSvg).blur(1.1).raw().toBuffer({ resolveWithObject: true });
const faceMaskAt = (pixel) => faceMask.data[pixel * faceMask.info.channels];

function hueAndSaturation(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
    else hue = 60 * ((rn - gn) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation: max ? delta / max : 0, value: max };
}

// Seed only the strongly colored hair/glasses/bow pixels that cross the face
// aperture. Dilation retains their anti-aliased dark edge without retaining the
// old eyes, lips or skin under the translucent lenses.
const accessorySeed = new Uint8Array(WIDTH * HEIGHT);
for (let y = 130; y <= 232; y++) {
  for (let x = 450; x <= 585; x++) {
    const pixel = y * WIDTH + x;
    if (!faceMaskAt(pixel)) continue;
    const sourcePixel = pixel * 4;
    const { hue, saturation, value } = hueAndSaturation(
      source.data[sourcePixel],
      source.data[sourcePixel + 1],
      source.data[sourcePixel + 2],
    );
    const glassesRegion = y >= 158 && y <= 212 && (y <= 198 || x <= 493 || x >= 540);
    const cyanFrame = glassesRegion && hue >= 165 && hue <= 215 && saturation >= 0.27;
    const yellowBow = y <= 198 && hue >= 32 && hue <= 72 && saturation >= 0.42;
    const greenHair = (y <= 176 || x <= 478) && hue >= 62 && hue <= 150 && saturation >= 0.52;
    const pinkHair = x <= 490 && y <= 196 && (hue >= 318 || hue <= 14) && saturation >= 0.54 && value >= 0.22;
    if (cyanFrame || yellowBow || greenHair || pinkHair) accessorySeed[pixel] = 255;
  }
}

const accessoryMask = accessorySeed;

const output = Buffer.from(source.data);
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const pixel = y * WIDTH + x;
    const p = pixel * 4;
    const sourceAlpha = source.data[p + 3];
    if (!sourceAlpha) continue;

    // Keep only the head/accessory layer. The center below the jaw is always
    // empty so no green fringe or old neck can be painted over the new face.
    if (y >= 278 || (y >= 244 && x >= 468 && x <= 562)) {
      output[p + 3] = 0;
      continue;
    }

    const hole = faceMaskAt(pixel) || 0;
    const baseAlpha = Math.round(sourceAlpha * (1 - hole / 255));
    output[p + 3] = accessoryMask[pixel] ? Math.max(baseAlpha, sourceAlpha) : baseAlpha;
  }
}

const candidate = await sharp(output, { raw: source.info }).png().toBuffer();
await fs.writeFile(candidatePath, candidate, { flag: "wx" });

for (const [name, background] of [
  ["white", "#ffffff"],
  ["charcoal", "#202725"],
  ["mint", "#c9f3e4"],
]) {
  await sharp(candidate).flatten({ background }).png().toFile(path.join(qaDirectory, `${name}.png`));
}

const manifest = {
  status: "candidate-needs-composite-review",
  source: { path: SOURCE, sha256: sha256(sourceFile) },
  output: { path: path.relative(projectRoot, candidatePath).replaceAll("\\", "/"), sha256: sha256(candidate) },
  rules: ["face skin removed", "hair/glasses/bow retained", "center neck cleared", "product artwork unchanged"],
};
await fs.writeFile(path.join(releaseRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });

if (install) {
  const runtimePath = path.join(projectRoot, "public/game/studio/layers", RUNTIME_NAME);
  await fs.writeFile(runtimePath, candidate, { flag: "wx" });
  await assertProductsUnchanged();
  console.log(`Installed ${path.relative(projectRoot, runtimePath)}`);
} else {
  console.log(`Built candidate ${path.relative(projectRoot, candidatePath)}`);
}
