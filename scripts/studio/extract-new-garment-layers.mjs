import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(
  root,
  "artifacts/studio/candidates/2026-09-13-new-reference-v1/model-worn-white/selected-current",
);
const outputDir = path.join(
  root,
  "artifacts/studio/candidates/2026-09-13-new-reference-v1/layers",
);

const configs = {
  "accessory-abstract-denim-hip-scarf.png": {
    box: [250, 400, 760, 705],
    keep: (r, g, b, value) => b / Math.max(g, 1) > 0.96 && (value < 150 || Math.max(r, b) - g > 12),
  },
  "bottom-front-slit-denim-skort.png": {
    box: [315, 390, 700, 690],
    keep: (r, g, b, value) => b >= r * 0.99 && b >= g * 0.97 && (b - r > 3 || value < 165),
  },
  "bottom-inside-out-cuff-jeans.png": {
    box: [315, 385, 705, 1115],
    keep: (r, g, b, value) => b >= r * 0.98 && (b >= g * 0.92 || value < 105),
  },
  "bottom-three-tone-wide-leg-jeans.png": {
    box: [275, 385, 750, 1135],
    keep: (r, g, b, value) => b >= r * 1.015 && (b >= g * 0.94 || value < 110),
  },
  "dress-strapless-deep-fold-denim.png": {
    box: [175, 215, 850, 1260],
    keep: (r, g, b, value) => b >= r * 1.03 && (b >= g * 0.94 || value < 115),
  },
  "legwear-pocket-denim-warmers.png": {
    box: [315, 650, 700, 1160],
    keep: (r, g, b, value) => b >= r * 1.01 && (b >= g * 0.92 || value < 105),
  },
  "top-asymmetric-gradient-denim-shirt.png": {
    box: [270, 260, 750, 690],
    keep: (r, g, b, value) => b / Math.max(g, 1) > 0.94 && (b / Math.max(r, 1) > 0.78 || value < 115),
  },
  "top-oversized-mint-zip-tank.png": {
    box: [350, 260, 680, 735],
    solid: [
      [435, 281], [468, 270], [491, 294], [533, 294], [555, 270], [612, 281],
      [623, 338], [625, 410], [637, 505], [650, 605], [666, 722],
      [358, 722], [375, 605], [388, 505], [400, 410], [401, 338],
    ],
    holes: [[
      [473, 296], [510, 451], [551, 296], [533, 289], [510, 405], [490, 289],
    ]],
    keep: (r, g, b, value) => (g >= r * 1.015 || b >= r * 1.03) && (value < 225 || g - r > 8),
  },
};

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function alphaForPixel(r, g, b, x, y, config) {
  const [left, top, right, bottom] = config.box;
  if (x < left || x > right || y < top || y > bottom) return 0;

  const value = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const distanceFromWhite = 255 - min;
  if (
    config.solid &&
    pointInPolygon(x, y, config.solid) &&
    !(config.holes || []).some((hole) => pointInPolygon(x, y, hole))
  ) return 255;
  if (distanceFromWhite < 7 || !config.keep(r, g, b, value)) return 0;

  // Retain the original antialiased edge while making interior textile opaque.
  if (distanceFromWhite < 24) return Math.round(((distanceFromWhite - 7) / 17) * 255);
  return 255;
}

await fs.mkdir(outputDir, { recursive: true });

for (const [filename, config] of Object.entries(configs)) {
  const source = path.join(sourceDir, filename);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== 1024 || info.height !== 1536 || info.channels !== 4) {
    throw new Error(`${filename}: expected 1024x1536 RGBA, received ${info.width}x${info.height}x${info.channels}`);
  }

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      data[offset + 3] = alphaForPixel(data[offset], data[offset + 1], data[offset + 2], x, y, config);
    }
  }

  const output = path.join(outputDir, filename);
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
  console.log(path.relative(root, output));
}
