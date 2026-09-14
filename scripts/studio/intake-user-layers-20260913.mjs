import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1024;
const HEIGHT = 1536;

const release = "2026-09-13-layer-release-v1";
const originalRoot = path.join("assets", "studio", "user-cutouts", release, "original");
const archiveRoot = path.join("assets", "studio", "user-cutouts", release);
const candidatesRoot = path.join("artifacts", "studio", "candidates", release);
const candidateLayersRoot = path.join(candidatesRoot, "layers");
const candidateQaRoot = path.join(candidatesRoot, "qa");
const runtimeLayersRoot = path.join("public", "game", "studio", "layers");

const items = [
  {
    id: "top-oversized-mint-zip-tank",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(5).png",
    name: "Oversized Mint Zip Tank",
    category: "tops",
    cleanSpecks: true,
  },
  {
    id: "top-asymmetric-gradient-denim-shirt",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(4).png",
    name: "Asymmetric Gradient Denim Shirt",
    category: "tops",
    cleanSpecks: true,
    filterWristSpeck: true,
  },
  {
    id: "bottom-three-tone-wide-leg-jeans",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(3).png",
    name: "Three-Tone Wide-Leg Jeans",
    category: "bottoms",
    cleanSpecks: false,
  },
  {
    id: "bottom-front-slit-denim-skort",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(2).png",
    name: "Front-Slit Denim Skort",
    category: "bottoms",
    cleanSpecks: false,
  },
  {
    id: "bottom-inside-out-cuff-jeans",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(1).png",
    name: "Inside-Out Cuff Jeans",
    category: "bottoms",
    cleanSpecks: false,
  },
  {
    id: "legwear-pocket-denim-warmers",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard).png",
    name: "Pocket Denim Leg Warmers",
    category: "shoes",
    cleanSpecks: true,
    yRange: [980, 1330],
  },
  {
    id: "accessory-abstract-denim-hip-scarf",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(7).png",
    name: "Abstract Denim Hip Scarf",
    category: "accessories",
    cleanSpecks: false,
  },
  {
    id: "dress-strapless-deep-fold-denim",
    file: "Chưa có tên (1024 x 1536 px) (Whiteboard)(6).png",
    name: "Strapless Deep-Fold Denim Dress",
    category: "dresses",
    cleanSpecks: true,
    yRange: [335, 1220],
  },
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function findComponents(rgba, width, height, alphaThreshold = 2) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const components = [];

  for (let start = 0; start < pixels; start++) {
    if (visited[start] || rgba[start * 4 + 3] <= alphaThreshold) continue;
    let head = 0;
    let tail = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    const pixelList = [];
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const pixel = queue[head++];
      pixelList.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      const neighbours = [pixel - 1, pixel + 1, pixel - width, pixel + width];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || neighbour >= pixels || visited[neighbour]) continue;
        if (neighbour === pixel - 1 && x === 0) continue;
        if (neighbour === pixel + 1 && x === width - 1) continue;
        if (rgba[neighbour * 4 + 3] <= alphaThreshold) continue;
        visited[neighbour] = 1;
        queue[tail++] = neighbour;
      }
    }

    components.push({
      size: pixelList.length,
      bounds: { left, top, width: right - left + 1, height: bottom - top + 1 },
      pixels: pixelList,
    });
  }

  components.sort((a, b) => b.size - a.size);
  return components;
}

await fs.mkdir(originalRoot, { recursive: true });
await fs.mkdir(candidateLayersRoot, { recursive: true });
await fs.mkdir(candidateQaRoot, { recursive: true });

const manifestEntries = [];
const calculatedBounds = {};

const modelUpper = path.join(runtimeLayersRoot, "model-dressed-upper.png");
const modelLower = path.join(runtimeLayersRoot, "model-lower.png");

for (const item of items) {
  const downloadSource = path.join("C:\\Users\\admin\\Downloads", item.file);
  const originalDest = path.join(originalRoot, `${item.id}.png`);

  // 1. Copy raw file to archive
  const rawBytes = await fs.readFile(downloadSource);
  await fs.writeFile(originalDest, rawBytes);
  const originalHash = sha256(rawBytes);

  // 2. Read and verify image
  const { data, info } = await sharp(rawBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== WIDTH || info.height !== HEIGHT || info.channels !== 4) {
    throw new Error(`${item.id}: Invalid dimensions ${info.width}x${info.height}`);
  }

  // 3. Clean dust/speck components
  const outputData = Buffer.from(data);
  const components = findComponents(data, WIDTH, HEIGHT, 2);

  for (const comp of components) {
    if (item.id === "legwear-pocket-denim-warmers") {
      // Keep only the two leg warmers
      if (comp.size < 1000) {
        for (const pixel of comp.pixels) outputData[pixel * 4 + 3] = 0;
      }
    } else if (item.filterWristSpeck && comp.bounds.top > 750) {
      // Clean detached wrist/skin speck
      for (const pixel of comp.pixels) outputData[pixel * 4 + 3] = 0;
    } else if (item.cleanSpecks && comp.size < 500) {
      // Dust specks
      for (const pixel of comp.pixels) outputData[pixel * 4 + 3] = 0;
    }
  }

  // Apply yRange clamp if specified to purge any faint isolated pixels
  if (item.yRange) {
    const [minY, maxY] = item.yRange;
    for (let y = 0; y < HEIGHT; y++) {
      if (y < minY || y > maxY) {
        for (let x = 0; x < WIDTH; x++) {
          outputData[(y * WIDTH + x) * 4 + 3] = 0;
        }
      }
    }
  }

  // 4. Calculate accurate bounds and pixel stats
  let minX = WIDTH, minY = HEIGHT, maxX = -1, maxY = -1;
  let visiblePixels = 0;
  let antialiasedPixels = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const a = outputData[(y * WIDTH + x) * 4 + 3];
      if (a > 2) {
        visiblePixels++;
        if (a < 250) antialiasedPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bounds = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  calculatedBounds[item.id] = bounds;

  // 5. Save candidate layer
  const candidateLayerPath = path.join(candidateLayersRoot, `${item.id}.png`);
  const cleanedBuffer = await sharp(outputData, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(candidateLayerPath, cleanedBuffer);
  const candidateHash = sha256(cleanedBuffer);

  // 6. Generate QA views
  const qaTransparentPath = path.join(candidateQaRoot, `${item.id}-transparent.png`);
  await fs.writeFile(qaTransparentPath, cleanedBuffer);

  for (const [bgName, bgColor] of [["white", "#ffffff"], ["dark", "#24212e"], ["mint", "#8ddbc8"]]) {
    const qaBgPath = path.join(candidateQaRoot, `${item.id}-${bgName}.png`);
    await sharp(cleanedBuffer).flatten({ background: bgColor }).png().toFile(qaBgPath);
  }

  // Generate on-model composite
  const qaOnModelPath = path.join(candidateQaRoot, `${item.id}-on-model.png`);
  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 245, g: 245, b: 247, alpha: 1 } },
  }).composite([
    { input: modelLower },
    { input: modelUpper },
    { input: candidateLayerPath },
  ]).png().toFile(qaOnModelPath);

  // 7. Collect report metadata
  manifestEntries.push({
    id: item.id,
    name: item.name,
    category: item.category,
    sourceFile: item.file,
    originalSha256: originalHash,
    candidateSha256: candidateHash,
    bounds,
    visiblePixels,
    antialiasedPixels,
  });

  console.log(`Processed: ${item.id} -> bounds:`, bounds);
}

// 8. Write manifest and candidate report
const manifestPath = path.join(archiveRoot, "manifest.json");
await fs.writeFile(manifestPath, JSON.stringify({ release, items: manifestEntries }, null, 2));

const candidateReportPath = path.join(candidatesRoot, "candidate-report.json");
await fs.writeFile(candidateReportPath, JSON.stringify({ release, calculatedBounds, items: manifestEntries }, null, 2));

console.log("\nIntake complete!");
console.log("Calculated Bounds for studio.ts:");
console.log(JSON.stringify(calculatedBounds, null, 2));
