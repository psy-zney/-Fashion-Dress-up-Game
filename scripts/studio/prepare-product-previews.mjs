import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { PRODUCT_OUTPUT, PRODUCT_PREVIEWS } from "./product-preview.config.mjs";

// Only remove light neutral pixels connected to the outside. Internal white
// polka dots/highlights are protected by the surrounding opaque garment.
function removeExterior(data, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index) => {
    if (seen[index]) return;
    const offset = index * 4;
    const rgb = [data[offset], data[offset + 1], data[offset + 2]];
    if (data[offset + 3] > 0 && !(Math.min(...rgb) >= 205 && Math.max(...rgb) - Math.min(...rgb) < 35)) return;
    seen[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width;
    data[index * 4 + 3] = 0;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
}

// Imagegen product exports may contain a baked checkerboard and therefore no
// useful source alpha. The flood fill above gives us a reliable silhouette,
// but a binary edge looks stair-stepped after the catalog scales it down. Keep
// the transition inside the detected garment so neutral checker pixels never
// become a light halo on dark UI backgrounds.
function antialiasInnerEdge(data, width, height) {
  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < alpha.length; index++) alpha[index] = data[index * 4 + 3];
  const weights = [1, 2, 1, 2, 4, 2, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      if (alpha[index] === 0) continue;
      let coverage = 0;
      let weightIndex = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (alpha[(y + dy) * width + x + dx] > 0) coverage += weights[weightIndex];
          weightIndex++;
        }
      }
      data[index * 4 + 3] = Math.round(255 * coverage / 16);
    }
  }
}

await fs.mkdir(PRODUCT_OUTPUT, { recursive: true });
const report = [];
const tiles = [];
for (const [id, config] of Object.entries(PRODUCT_PREVIEWS)) {
  const source = config.source || `assets/studio/sources/products/original/${id}.png`;
  const input = await fs.readFile(source);
  const { data, info: { width, height } } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (config.mode === "exterior") {
    removeExterior(data, width, height);
    antialiasInnerEdge(data, width, height);
  }
  if (config.mode === "silhouette") {
    if (width !== 1024 || height !== 1536) throw new Error(`${id}: silhouette requires original canvas`);
    const mask = await sharp(Buffer.from(`<svg width="1024" height="1536" xmlns="http://www.w3.org/2000/svg"><path fill="white" d="${config.outline}"/></svg>`)).ensureAlpha().raw().toBuffer();
    for (let index = 0; index < width * height; index++) data[index * 4 + 3] = mask[index * 4 + 3];
  }
  // Approved product silhouettes are well inside the frame. Clear only the
  // outer 4px guard band: source exports contain a few stray corner pixels.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) data[(y * width + x) * 4 + 3] = 0;
    }
  }
  let transparent = 0;
  for (let index = 0; index < width * height; index++) if (data[index * 4 + 3] === 0) transparent++;
  if (transparent / (width * height) < .2) throw new Error(`${id}: missing actual transparent background`);
  const output = path.join(PRODUCT_OUTPUT, `${id}.png`);
  const png = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await fs.writeFile(output, png);
  report.push({ id, source, output, width, height, mode: config.mode, transparentRatio: transparent / (width * height), sourceSha256: crypto.createHash("sha256").update(input).digest("hex") });
  tiles.push({ input: await sharp(png).resize(240, 300, { fit: "contain", background: "#65d7bb" }).flatten({ background: "#65d7bb" }).png().toBuffer(), left: (tiles.length % 5) * 240, top: Math.floor(tiles.length / 5) * 300 });
}
await fs.mkdir("artifacts/studio/qa/products", { recursive: true });
await fs.writeFile("artifacts/studio/qa/products/report.json", JSON.stringify(report, null, 2));
await sharp({ create: { width: 1200, height: 900, channels: 4, background: "#65d7bb" } }).composite(tiles).png().toFile("artifacts/studio/qa/products/contact-sheet.png");
console.log(`Prepared ${report.length} transparent product previews. Model layers and original art unchanged.`);
