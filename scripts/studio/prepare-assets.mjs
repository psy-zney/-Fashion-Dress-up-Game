import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CONFIGS, PATHS, STAGE } from "./pipeline.config.mjs";

const MODEL_PATH = PATHS.model;
const SOURCE_WORN = PATHS.sourceWorn;
const READY_OUT = PATHS.runtimeLayers;
const PREVIEW_OUT = PATHS.previews;

function looksLikeSkin(r, g, b) {
  return r > 145 && g > 75 && b > 45 && r - g > 28 && g - b > 18;
}

function looksLikeBodyArtifact(r, g, b) {
  return r > 68 && r - g > 12 && g - b > 6;
}

function matchesPreviewPalette(palette, r, g, b) {
  const lightness = Math.max(r, g, b);
  const chroma = lightness - Math.min(r, g, b);
  if (palette === "lightNeutral") {
    return lightness > 105 && chroma < 26 && !(r - g > 12 && g - b > 6);
  }
  if (palette === "darkNeutral") return lightness < 198 && chroma < 16;
  if (palette === "neutral") return chroma < 18;
  if (palette === "ivory") return lightness > 105 && chroma < 55 && !(r - g > 25 && g - b > 12);
  if (palette === "red") return r > 65 && r > g * 1.4 && r > b * 1.12;
  return true;
}

function keepLargestAlphaComponent(rgba, width, height) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let largest = [];

  for (let seed = 0; seed < pixels; seed++) {
    if (visited[seed] || rgba[seed * 4 + 3] === 0) continue;
    let head = 0;
    let tail = 0;
    const component = [];
    visited[seed] = 1;
    queue[tail++] = seed;

    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      const x = index % width;
      const candidates = [index - width, index + width];
      if (x > 0) candidates.push(index - 1);
      if (x < width - 1) candidates.push(index + 1);
      for (const next of candidates) {
        if (next < 0 || next >= pixels || visited[next] || rgba[next * 4 + 3] === 0) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }

    if (component.length > largest.length) largest = component;
  }

  const keep = new Uint8Array(pixels);
  for (const index of largest) keep[index] = 1;
  for (let index = 0; index < pixels; index++) {
    if (!keep[index]) rgba[index * 4 + 3] = 0;
  }
}

function removeNarrowRowFragments(rgba, width, height, minimumWidth) {
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      while (x < width && rgba[(y * width + x) * 4 + 3] === 0) x++;
      const start = x;
      while (x < width && rgba[(y * width + x) * 4 + 3] > 0) x++;
      if (x - start > 0 && x - start < minimumWidth) {
        for (let clearX = start; clearX < x; clearX++) {
          rgba[(y * width + clearX) * 4 + 3] = 0;
        }
      }
    }
  }
}

function removeUnsupportedDarkNoise(rgba, width, height) {
  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < alpha.length; index++) alpha[index] = rgba[index * 4 + 3];

  for (let y = 3; y < height - 3; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const offset = index * 4;
      if (alpha[index] === 0 || Math.max(rgba[offset], rgba[offset + 1], rgba[offset + 2]) >= 120) continue;
      let verticalSupport = 0;
      for (let delta = -3; delta <= 3; delta++) {
        if (delta !== 0 && alpha[index + delta * width] > 0) verticalSupport++;
      }
      if (verticalSupport < 3) rgba[offset + 3] = 0;
    }
  }
}

function computeBounds(rgba, width, height, threshold = 30) {
  let minX = width, maxX = 0, minY = height, maxY = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a > threshold) {
        count++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (count === 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, visiblePixels: count };
}

function trimLightExterior(rgba, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index) => {
    if (visited[index]) return;
    const offset = index * 4;
    const red = rgba[offset], green = rgba[offset + 1], blue = rgba[offset + 2];
    if (rgba[offset + 3] > 0 && !(Math.min(red, green, blue) > 220 && Math.max(red, green, blue) - Math.min(red, green, blue) < 25)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width;
    rgba[index * 4 + 3] = 0;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
}

function removeCheckerboard(rgba, width, height) {
  const pixels = width * height;
  const period = 32;
  const sums = new Float64Array(period * period * 3);
  const counts = new Uint32Array(period * period);
  const border = 152;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= border && x < width - border && y >= border && y < height - border) continue;
      const offset = (y * width + x) * 4;
      const red = rgba[offset];
      const green = rgba[offset + 1];
      const blue = rgba[offset + 2];
      if (Math.min(red, green, blue) < 210 || Math.max(red, green, blue) - Math.min(red, green, blue) > 24) continue;
      const cell = (y % period) * period + (x % period);
      sums[cell * 3] += red;
      sums[cell * 3 + 1] += green;
      sums[cell * 3 + 2] += blue;
      counts[cell]++;
    }
  }

  const template = new Float32Array(period * period * 3);
  for (let cell = 0; cell < counts.length; cell++) {
    const count = counts[cell] || 1;
    template[cell * 3] = sums[cell * 3] / count;
    template[cell * 3 + 1] = sums[cell * 3 + 1] / count;
    template[cell * 3 + 2] = sums[cell * 3 + 2] / count;
  }

  const candidate = new Uint8Array(pixels);
  const outside = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let start = 0;
  let end = 0;

  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const x = index % width;
    const y = Math.floor(index / width);
    const cell = ((y % period) * period + (x % period)) * 3;
    const dr = red - template[cell];
    const dg = green - template[cell + 1];
    const db = blue - template[cell + 2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    candidate[index] = Math.min(red, green, blue) > 206 && Math.max(red, green, blue) - Math.min(red, green, blue) < 28 && distance < 24 ? 1 : 0;
  }

  const visit = (index) => {
    if (index < 0 || index >= pixels || outside[index] || !candidate[index]) return;
    outside[index] = 1;
    queue[end++] = index;
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (start < end) {
    const index = queue[start++];
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < pixels - width) visit(index + width);
  }

  for (let index = 0; index < pixels; index++) {
    if (outside[index]) rgba[index * 4 + 3] = 0;
  }
  return rgba;
}

async function run() {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  for (const id of requested) if (!CONFIGS[id]) throw new Error(`Unknown garment: ${id}`);
  // Preserve the last runtime release before regenerating any derived files.
  const backup = path.join("assets/studio/archive", new Date().toISOString().replaceAll(":", "-"));
  try { await fs.access(READY_OUT); await fs.cp(READY_OUT, path.join(backup, "layers"), { recursive: true }); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await fs.mkdir(READY_OUT, { recursive: true });
  await fs.mkdir(PREVIEW_OUT, { recursive: true });

  const nudeRaw = await sharp(MODEL_PATH).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: nudeData, info: nudeInfo } = nudeRaw;
  const { width, height } = nudeInfo;
  if (width !== STAGE.width || height !== STAGE.height) {
    throw new Error(`Model master must be ${STAGE.width}x${STAGE.height}; received ${width}x${height}`);
  }

  let previousReport = [];
  if (requested.length) previousReport = JSON.parse(await fs.readFile(path.join(READY_OUT, "asset-report.json"), "utf8"));
  const report = previousReport.filter((item) => !requested.includes(item.id));

  // Extract worn sprites
  for (const [id, cfg] of Object.entries(CONFIGS)) {
    if (requested.length && !requested.includes(id)) continue;
    const srcFile = path.join(cfg.sourceDir || SOURCE_WORN, cfg.sourceFile || `${id}.png`);
    const wornRaw = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data: wornData, info: wornInfo } = wornRaw;
    if (wornInfo.width !== width || wornInfo.height !== height || wornInfo.channels < 3) {
      throw new Error(`${id} source must be ${width}x${height} RGB/RGBA; received ${wornInfo.width}x${wornInfo.height}`);
    }

    const rgba = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      if (y < cfg.minY || y > cfg.maxY) continue;
      for (let x = 0; x < width; x++) {
        if (x < cfg.minX || x > cfg.maxX) continue;

        // Neck cut check (keep open collar without picking up neck/face skin)
        if (cfg.neckMinY && cfg.neckX) {
          if (y < cfg.neckMinY && x >= cfg.neckX.min && x <= cfg.neckX.max) continue;
        }

        // Waist center check for tops with long sleeves
        if (cfg.waistMaxY && cfg.waistX) {
          if (y > cfg.waistMaxY && x >= cfg.waistX.min && x <= cfg.waistX.max) continue;
        }

        const idx = (y * width + x) * 3;
        const oIdx = (y * width + x) * 4;

        const dist = Math.max(
          Math.abs(nudeData[idx] - wornData[idx]),
          Math.abs(nudeData[idx + 1] - wornData[idx + 1]),
          Math.abs(nudeData[idx + 2] - wornData[idx + 2])
        );

        let isIncluded = dist > cfg.threshold;
        const red = wornData[idx];
        const green = wornData[idx + 1];
        const blue = wornData[idx + 2];
        const lightness = Math.max(red, green, blue);
        const chroma = lightness - Math.min(red, green, blue);

        if (isIncluded && cfg.onlyNeutral && (lightness < 92 || chroma > 66)) {
          isIncluded = false;
        }
        if (isIncluded && cfg.onlyDark && lightness > 235) {
          isIncluded = false;
        }
        if (isIncluded && cfg.filterSkin && looksLikeSkin(red, green, blue)) {
          isIncluded = false;
        }
        if (cfg.decolletage) {
          const d = cfg.decolletage;
          if (x >= d.minX && x <= d.maxX && y >= d.minY && y <= d.maxY) {
            isIncluded = true;
          }
        }

        // Filter out skin artifacts at waist hem
        if (isIncluded && cfg.filterSkinAtWaist && y >= 620 && x >= 380 && x <= 644) {
          const g = wornData[idx + 1], b = wornData[idx + 2];
          if (g > 80 && b > 60) {
            isIncluded = false;
          }
        }

        if (isIncluded) {
          rgba[oIdx] = wornData[idx];
          rgba[oIdx + 1] = wornData[idx + 1];
          rgba[oIdx + 2] = wornData[idx + 2];
          rgba[oIdx + 3] = 255;
        }
      }
    }

    if (cfg.fillBetweenEdges) {
      for (let y = cfg.minY; y <= cfg.maxY; y++) {
        let rowMin = width;
        let rowMax = -1;
        let rowCount = 0;
        for (let x = cfg.minX; x <= cfg.maxX; x++) {
          const alpha = rgba[(y * width + x) * 4 + 3];
          if (alpha > 0) {
            rowMin = Math.min(rowMin, x);
            rowMax = Math.max(rowMax, x);
            rowCount++;
          }
        }
        if (rowCount < 18 || rowMax - rowMin < 80) continue;
        for (let x = rowMin; x <= rowMax; x++) {
          const idx = (y * width + x) * 3;
          const oIdx = (y * width + x) * 4;
          const red = wornData[idx];
          const green = wornData[idx + 1];
          const blue = wornData[idx + 2];
          const isBackground = red > 250 && green > 250 && blue > 250;
          if (!isBackground && !looksLikeSkin(red, green, blue)) {
            rgba[oIdx] = red;
            rgba[oIdx + 1] = green;
            rgba[oIdx + 2] = blue;
            rgba[oIdx + 3] = 255;
          }
        }
      }
    }

    if (cfg.filterBodyArtifacts) {
      for (let index = 0; index < width * height; index++) {
        const offset = index * 4;
        if (rgba[offset + 3] === 0) continue;
        if (looksLikeBodyArtifact(rgba[offset], rgba[offset + 1], rgba[offset + 2])) {
          rgba[offset + 3] = 0;
        }
      }
    }

    if (cfg.trimLightExterior) trimLightExterior(rgba, width, height);
    if (cfg.keepLargestComponent) {
      keepLargestAlphaComponent(rgba, width, height);
    }
    if (cfg.category === "bottoms" && !cfg.preserveContinuousFabric) {
      removeNarrowRowFragments(rgba, width, height, 42);
      removeUnsupportedDarkNoise(rgba, width, height);
    }

    const bounds = computeBounds(rgba, width, height);
    report.push({
      id,
      category: cfg.category,
      name: cfg.name,
      width,
      height,
      hasAlpha: true,
      bounds,
    });

    const outSprite = path.join(READY_OUT, `${id}.png`);
    await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(outSprite);
    if (!bounds) throw new Error(`No visible pixels remain for ${id}`);
    const previewRgba = Buffer.from(rgba);
    if (cfg.previewPalette) {
      for (let index = 0; index < width * height; index++) {
        const offset = index * 4;
        if (
          previewRgba[offset + 3] > 0 &&
          !matchesPreviewPalette(cfg.previewPalette, previewRgba[offset], previewRgba[offset + 1], previewRgba[offset + 2])
        ) {
          previewRgba[offset + 3] = 0;
        }
      }
      if (cfg.category !== "shoes") keepLargestAlphaComponent(previewRgba, width, height);
    }
    const previewBounds = computeBounds(previewRgba, width, height);
    if (!previewBounds) throw new Error(`No preview pixels remain for ${id}`);
    const padding = Math.max(12, Math.round(Math.max(previewBounds.width, previewBounds.height) * 0.06));
    await sharp(previewRgba, { raw: { width, height, channels: 4 } })
      .extract({ left: previewBounds.left, top: previewBounds.top, width: previewBounds.width, height: previewBounds.height })
      .extend({
        top: padding,
        right: padding,
        bottom: padding,
        left: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(PREVIEW_OUT, `${id}.png`));
    console.log(`Generated ready sprite: ${id}`);
  }

  // Keep the runtime model on the exact master canvas and remove its baked checkerboard.
  const modelRaw = await sharp(MODEL_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const transparentModel = removeCheckerboard(Buffer.from(modelRaw.data), modelRaw.info.width, modelRaw.info.height);
  await sharp(transparentModel, {
    raw: { width: modelRaw.info.width, height: modelRaw.info.height, channels: 4 },
  }).png().toFile(path.join(READY_OUT, "model.png"));
  const bootBase = Buffer.from(transparentModel);
  // The boot sprite replaces both lower legs, including their silhouette.
  for (let y = 995; y < height; y++) {
    for (let x = 0; x < width; x++) bootBase[(y * width + x) * 4 + 3] = 0;
  }
  await sharp(bootBase, { raw: { width, height, channels: 4 } }).png().toFile(path.join(READY_OUT, "model-boots.png"));

  // Save ready.json and asset-report.json
  const readyJson = {
    version: "studio-2.0",
    catalogGarments: report.length,
    items: report.map((r) => ({ id: r.id, category: r.category, name: r.name })),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(READY_OUT, "ready.json"), JSON.stringify(readyJson, null, 2), "utf8");
  await fs.writeFile(path.join(READY_OUT, "asset-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`Generated layers: ${READY_OUT}; cropped previews: ${PREVIEW_OUT}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
