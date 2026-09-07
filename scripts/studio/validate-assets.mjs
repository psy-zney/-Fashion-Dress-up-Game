import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CONFIGS, INTERACTIONS, PATHS, QUALITY_LIMITS, STAGE } from "./pipeline.config.mjs";

const errors = [];
const warnings = [];
const items = [];

function fail(scope, message) {
  errors.push({ scope, message });
}

function warn(scope, message) {
  warnings.push({ scope, message });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function alphaBounds(data, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  let visiblePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      visiblePixels++;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (visiblePixels === 0) return null;
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    visiblePixels,
  };
}

function hash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function validateCanvas(file, scope, requireAlpha) {
  if (!(await exists(file))) {
    fail(scope, `Missing file: ${file}`);
    return null;
  }
  const metadata = await sharp(file).metadata();
  if (metadata.width !== STAGE.width || metadata.height !== STAGE.height) {
    fail(scope, `Expected ${STAGE.width}x${STAGE.height}, received ${metadata.width}x${metadata.height}`);
  }
  if (requireAlpha && !metadata.hasAlpha) fail(scope, "PNG must contain an alpha channel");
  return metadata;
}

async function validate() {
  await fs.mkdir(path.dirname(PATHS.validationReport), { recursive: true });
  await validateCanvas(PATHS.model, "model-source", false);
  await validateCanvas(path.join(PATHS.runtimeLayers, "model.png"), "model-runtime", true);
  const bootBaseFile = path.join(PATHS.runtimeLayers, "model-boots.png");
  if (await validateCanvas(bootBaseFile, "model-boots", true)) {
    const bootBase = await sharp(bootBaseFile).ensureAlpha().raw().toBuffer();
    for (let index = 995 * STAGE.width; index < STAGE.width * STAGE.height; index++) {
      if (bootBase[index * 4 + 3] !== 0) {
        fail("model-boots", "Base legs remain visible below boot collar y995");
        break;
      }
    }
  }

  const categoryCounts = { tops: 0, bottoms: 0, shoes: 0 };
  const sourceHashes = new Map();

  for (const [id, config] of Object.entries(CONFIGS)) {
    categoryCounts[config.category] = (categoryCounts[config.category] || 0) + 1;
    const scope = `garment:${id}`;
    const coordinates = [config.minX, config.maxX, config.minY, config.maxY, config.threshold];
    if (!coordinates.every(Number.isFinite)) fail(scope, "Extraction coordinates and threshold must be finite numbers");
    if (config.minX < 0 || config.minY < 0 || config.maxX >= STAGE.width || config.maxY >= STAGE.height) {
      fail(scope, "Extraction box leaves the canonical stage");
    }
    if (config.minX >= config.maxX || config.minY >= config.maxY) fail(scope, "Extraction box is inverted or empty");

    const sourceFile = path.join(config.sourceDir || PATHS.sourceWorn, config.sourceFile || `${id}.png`);
    await validateCanvas(sourceFile, `${scope}:source`, false);
    if (await exists(sourceFile)) {
      const sourceHash = hash(await fs.readFile(sourceFile));
      if (sourceHashes.has(sourceHash)) warn(scope, `Source is byte-identical to ${sourceHashes.get(sourceHash)}`);
      sourceHashes.set(sourceHash, id);
    }

    const layerFile = path.join(PATHS.runtimeLayers, `${id}.png`);
    const layerMeta = await validateCanvas(layerFile, `${scope}:layer`, true);
    let layerBounds = null;
    if (layerMeta) {
      const raw = await sharp(layerFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      layerBounds = alphaBounds(raw.data, raw.info.width, raw.info.height);
      if (!layerBounds || layerBounds.visiblePixels < QUALITY_LIMITS.minimumVisiblePixels) {
        fail(scope, `Runtime layer has too few visible pixels (${layerBounds?.visiblePixels || 0})`);
      } else if (
        layerBounds.left < config.minX ||
        layerBounds.top < config.minY ||
        layerBounds.left + layerBounds.width - 1 > config.maxX ||
        layerBounds.top + layerBounds.height - 1 > config.maxY
      ) {
        fail(scope, "Visible runtime pixels escape the configured extraction box");
      }
    }

    // Runtime validation must inspect the product cutouts the browser actually
    // serves, not disposable extraction previews under artifacts/.
    const previewFile = path.join(PATHS.validationPreviews, `${id}.png`);
    if (!(await exists(previewFile))) {
      fail(`${scope}:preview`, `Missing file: ${previewFile}`);
    } else {
      const preview = await sharp(previewFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const previewBounds = alphaBounds(preview.data, preview.info.width, preview.info.height);
      if (
        preview.info.width < QUALITY_LIMITS.minimumPreviewDimension ||
        preview.info.height < QUALITY_LIMITS.minimumPreviewDimension
      ) {
        fail(`${scope}:preview`, `Preview is unexpectedly small (${preview.info.width}x${preview.info.height})`);
      }
      if (!previewBounds) {
        fail(`${scope}:preview`, "Preview is fully transparent");
      } else {
        const occupancy = (previewBounds.width * previewBounds.height) / (preview.info.width * preview.info.height);
        const occupancyMin = QUALITY_LIMITS.previewOccupancyMinByCategory?.[config.category]
          ?? QUALITY_LIMITS.previewOccupancyMin;
        if (occupancy < occupancyMin || occupancy > QUALITY_LIMITS.previewOccupancyMax) {
          warn(`${scope}:preview`, `Occupancy ${occupancy.toFixed(3)} is outside the preferred range`);
        }
        if (
          previewBounds.left === 0 ||
          previewBounds.top === 0 ||
          previewBounds.left + previewBounds.width === preview.info.width ||
          previewBounds.top + previewBounds.height === preview.info.height
        ) {
          fail(`${scope}:preview`, "Preview has no transparent safety padding on one or more edges");
        }
      }
    }

    items.push({ id, category: config.category, sourceFile, layerBounds });
  }

  for (const [category, expected] of Object.entries(QUALITY_LIMITS.expectedCategories)) {
    if (categoryCounts[category] !== expected) {
      fail("catalog", `${category} expected ${expected} items, received ${categoryCounts[category] || 0}`);
    }
  }

  const configIds = new Set(Object.keys(CONFIGS));
  for (const id of [INTERACTIONS.tallBootId, ...INTERACTIONS.longBottomIds].filter(Boolean)) {
    if (!configIds.has(id)) fail("interactions", `Unknown compatibility item: ${id}`);
  }
  if (INTERACTIONS.tallBootId && (INTERACTIONS.tallBootClipRatio <= 0 || INTERACTIONS.tallBootClipRatio >= 1)) {
    fail("interactions", "Tall boot clip ratio must be between 0 and 1");
  }

  const readyFile = path.join(PATHS.runtimeLayers, "ready.json");
  if (!(await exists(readyFile))) {
    fail("catalog", `Missing file: ${readyFile}`);
  } else {
    const ready = JSON.parse(await fs.readFile(readyFile, "utf8"));
    const readyIds = new Set((ready.items || []).map((item) => item.id));
    if (ready.catalogGarments !== configIds.size) fail("catalog", "ready.json count does not match pipeline config");
    for (const id of configIds) if (!readyIds.has(id)) fail("catalog", `ready.json is missing ${id}`);
  }

  const studioSource = await fs.readFile("src/lib/studio.ts", "utf8");
  const activeCatalog = studioSource.match(/export const garments: Garment\[\] = \[([\s\S]*?)\n\];/)?.[1];
  if (!activeCatalog) fail("web-catalog", "Could not locate the active garments catalog");
  const appIds = new Set([...(activeCatalog || "").matchAll(/\{ id: "([^"]+)", name:/g)].map((match) => match[1]));
  for (const id of configIds) if (!appIds.has(id)) fail("web-catalog", `src/lib/studio.ts is missing ${id}`);
  for (const id of appIds) if (!configIds.has(id)) fail("web-catalog", `Pipeline config is missing ${id}`);

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 ? "pass" : "fail",
    stage: STAGE,
    counts: { garments: items.length, categories: categoryCounts, errors: errors.length, warnings: warnings.length },
    interactions: INTERACTIONS,
    errors,
    warnings,
    items,
  };
  await fs.writeFile(PATHS.validationReport, JSON.stringify(report, null, 2), "utf8");

  console.log(`Studio asset validation: ${report.status.toUpperCase()}`);
  console.log(`Garments: ${items.length}; errors: ${errors.length}; warnings: ${warnings.length}`);
  for (const issue of errors) console.error(`ERROR [${issue.scope}] ${issue.message}`);
  for (const issue of warnings) console.warn(`WARN  [${issue.scope}] ${issue.message}`);
  console.log(`Report: ${PATHS.validationReport}`);
  if (errors.length > 0) process.exitCode = 1;
}

validate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
