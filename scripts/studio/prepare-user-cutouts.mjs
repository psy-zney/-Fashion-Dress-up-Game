import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1024;
const HEIGHT = 1536;
const release = "2026-09-11-layer-refresh-v1";
const archiveRoot = path.join("assets", "studio", "user-cutouts", release);
const originalRoot = path.join(archiveRoot, "original");
const alignedRoot = path.join(archiveRoot, "aligned");
const qaRoot = path.join("artifacts", "studio", "candidates", `${release}-intake`, "qa");

const layers = [
  {
    id: "top-modal-grommet",
    target: { left: 384, top: 274, width: 280, height: 389 },
  },
  {
    id: "top-fitted-denim",
    target: { left: 402, top: 250, width: 244, height: 406 },
  },
  {
    id: "bottom-sculpted-jeans",
    target: { left: 283, top: 541, width: 503, height: 898 },
  },
];

function assertStage(info, id) {
  if (info.width !== WIDTH || info.height !== HEIGHT || info.channels !== 4) {
    throw new Error(`${id}: expected ${WIDTH}x${HEIGHT} RGBA input`);
  }
}

function largestComponentMask(rgba, width, height, threshold = 8) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let winner = [];
  let winnerBounds = null;

  for (let start = 0; start < pixels; start++) {
    if (visited[start] || rgba[start * 4 + 3] <= threshold) continue;
    let head = 0;
    let tail = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    const component = [];
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
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
        if (rgba[neighbour * 4 + 3] <= threshold) continue;
        visited[neighbour] = 1;
        queue[tail++] = neighbour;
      }
    }

    if (component.length > winner.length) {
      winner = component;
      winnerBounds = { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
    }
  }

  if (!winnerBounds) throw new Error("No visible garment component found");
  const keep = new Uint8Array(pixels);
  winner.forEach((pixel) => { keep[pixel] = 1; });
  return { keep, bounds: winnerBounds, visiblePixels: winner.length };
}

async function alignLayer({ id, target }) {
  const input = path.join(originalRoot, `${id}.png`);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assertStage(info, id);
  const { keep, bounds, visiblePixels } = largestComponentMask(data, info.width, info.height);

  for (let pixel = 0; pixel < keep.length; pixel++) {
    if (!keep[pixel]) data[pixel * 4 + 3] = 0;
  }

  const isolated = await sharp(data, { raw: info })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize(target.width, target.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const stage = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: isolated, left: target.left, top: target.top }]).png().toBuffer();

  await fs.writeFile(path.join(alignedRoot, `${id}.png`), stage);
  return { id, sourceBounds: bounds, targetBounds: target, visiblePixels };
}

async function createModelSplit() {
  const model = await sharp(path.join(originalRoot, "model.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lower = await sharp(path.join(originalRoot, "model-lower.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const modelBoots = await sharp(path.join(originalRoot, "model-boots.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lowerBootsMask = await sharp(path.join(originalRoot, "model-lower-boots.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assertStage(model.info, "model");
  assertStage(lower.info, "model-lower");
  assertStage(modelBoots.info, "model-boots");
  assertStage(lowerBootsMask.info, "model-lower-boots");
  const upperData = Buffer.from(model.data);
  const lowerData = Buffer.alloc(model.data.length);
  const lowerBootsData = Buffer.alloc(modelBoots.data.length);

  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++) {
    const p = pixel * 4;
    if (lower.data[p + 3] > 0) {
      upperData[p + 3] = 0;
      model.data.copy(lowerData, p, p, p + 4);
    }
    if (lowerBootsMask.data[p + 3] > 0) modelBoots.data.copy(lowerBootsData, p, p, p + 4);
  }

  await sharp(upperData, { raw: model.info }).png().toFile(path.join(alignedRoot, "model-upper.png"));
  await sharp(lowerData, { raw: model.info }).png().toFile(path.join(alignedRoot, "model-lower.png"));
  await sharp(lowerBootsData, { raw: modelBoots.info }).png().toFile(path.join(alignedRoot, "model-lower-boots.png"));

  const generated = await sharp(path.join(archiveRoot, "generated", "model-dressed-checkerboard-source.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (generated.info.width !== WIDTH || generated.info.height !== HEIGHT || generated.info.channels !== 3) {
    throw new Error(`model-dressed: expected ${WIDTH}x${HEIGHT} RGB generated source`);
  }
  const dressedUpper = Buffer.alloc(WIDTH * HEIGHT * 4);
  const alphaMask = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++) {
    const rgba = pixel * 4;
    const rgb = pixel * 3;
    dressedUpper[rgba] = generated.data[rgb];
    dressedUpper[rgba + 1] = generated.data[rgb + 1];
    dressedUpper[rgba + 2] = generated.data[rgb + 2];
    dressedUpper[rgba + 3] = lower.data[rgba + 3] > 0 ? 0 : model.data[rgba + 3];
    alphaMask[rgba] = alphaMask[rgba + 1] = alphaMask[rgba + 2] = 255;
    alphaMask[rgba + 3] = model.data[rgba + 3];
  }
  await sharp(alphaMask, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toFile(path.join(archiveRoot, "masks", "model-alpha-mask.png"));
  await sharp(dressedUpper, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toFile(path.join(alignedRoot, "model-dressed-upper.png"));
}

async function createGrommetSkinBacking() {
  const shirt = await sharp(path.join(alignedRoot, "top-modal-grommet.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const model = await sharp(path.join(alignedRoot, "model-dressed-upper.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = layers.find(({ id }) => id === "top-modal-grommet").target;
  const visited = new Uint8Array(WIDTH * HEIGHT);
  const queue = new Int32Array(WIDTH * HEIGHT);
  const holes = [];

  for (let y = target.top; y < target.top + target.height; y++) {
    for (let x = target.left; x < target.left + target.width; x++) {
      const start = y * WIDTH + x;
      if (visited[start] || shirt.data[start * 4 + 3] > 8) continue;
      let head = 0;
      let tail = 0;
      let touchesBoundary = false;
      const component = [];
      queue[tail++] = start;
      visited[start] = 1;
      while (head < tail) {
        const pixel = queue[head++];
        component.push(pixel);
        const px = pixel % WIDTH;
        const py = Math.floor(pixel / WIDTH);
        if (px === target.left || px === target.left + target.width - 1 || py === target.top || py === target.top + target.height - 1) {
          touchesBoundary = true;
        }
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
          if (nx < target.left || nx >= target.left + target.width || ny < target.top || ny >= target.top + target.height) continue;
          const neighbour = ny * WIDTH + nx;
          if (visited[neighbour] || shirt.data[neighbour * 4 + 3] > 8) continue;
          visited[neighbour] = 1;
          queue[tail++] = neighbour;
        }
      }
      if (!touchesBoundary && component.length >= 8) holes.push(component);
    }
  }

  holes.sort((a, b) => b.length - a.length);
  const selected = holes.slice(0, 3);
  if (selected.length !== 3) throw new Error(`Expected 3 enclosed grommet holes, found ${selected.length}`);
  const backing = Buffer.alloc(WIDTH * HEIGHT * 4);
  const coverage = new Uint8Array(WIDTH * HEIGHT);
  for (const component of selected) {
    for (const pixel of component) {
      const x = pixel % WIDTH;
      const y = Math.floor(pixel / WIDTH);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const distance = dx * dx + dy * dy;
        if (distance > 16) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
          const weight = distance <= 4 ? 255 : distance <= 9 ? 160 : 64;
          coverage[ny * WIDTH + nx] = Math.max(coverage[ny * WIDTH + nx], weight);
        }
      }
    }
  }
  for (let pixel = 0; pixel < coverage.length; pixel++) {
    if (!coverage[pixel]) continue;
    const p = pixel * 4;
    backing[p] = model.data[p];
    backing[p + 1] = model.data[p + 1];
    backing[p + 2] = model.data[p + 2];
    backing[p + 3] = Math.round(model.data[p + 3] * coverage[pixel] / 255);
  }
  await sharp(backing, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png()
    .toFile(path.join(alignedRoot, "top-modal-grommet-skin.png"));
  return selected.map((component) => {
    const xs = component.map((pixel) => pixel % WIDTH);
    const ys = component.map((pixel) => Math.floor(pixel / WIDTH));
    return { pixels: component.length, left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  });
}

async function createJeansUnderModal() {
  const jeans = await sharp(path.join(alignedRoot, "bottom-sculpted-jeans.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shirt = await sharp(path.join(alignedRoot, "top-modal-grommet.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(jeans.data);
  const firstOverlapY = 541;
  const lastClipY = 653;

  const spanAt = (rgba, y, threshold = 32) => {
    let left = WIDTH;
    let right = -1;
    for (let x = 0; x < WIDTH; x++) {
      if (rgba[(y * WIDTH + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      right = x;
    }
    return right >= left ? { left, right } : null;
  };

  for (let y = firstOverlapY; y <= lastClipY; y++) {
    const shirtSpan = spanAt(shirt.data, y);
    const jeansSpan = spanAt(jeans.data, y, 8);
    if (!jeansSpan || !shirtSpan) continue;
    const left = shirtSpan.left;
    const right = shirtSpan.right;
    for (let x = jeansSpan.left; x <= jeansSpan.right; x++) {
      const p = (y * WIDTH + x) * 4;
      if (x < left || x > right) output[p + 3] = 0;
      else if (x === left || x === right) output[p + 3] = Math.round(output[p + 3] * 0.45);
      else if (x === left + 1 || x === right - 1) output[p + 3] = Math.round(output[p + 3] * 0.8);
    }
  }

  await sharp(output, { raw: jeans.info }).png().toFile(path.join(alignedRoot, "bottom-sculpted-jeans-under-yellow.png"));
  return { firstOverlapY, lastClipY, fullJeansRestoredAtY: lastClipY + 1 };
}

async function compositeQa(name, layerIds, dressed = false) {
  const inputs = [
    path.join(alignedRoot, "model-lower.png"),
    path.join(alignedRoot, dressed ? "model-dressed-upper.png" : "model-upper.png"),
    ...layerIds.map((id) => path.join(alignedRoot, `${id}.png`)),
  ];
  const transparent = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(inputs.map((input) => ({ input }))).png().toBuffer();
  await sharp(transparent).png().toFile(path.join(qaRoot, `${name}-transparent.png`));
  for (const [suffix, background] of [["white", "#ffffff"], ["dark", "#24212e"], ["mint", "#8ddbc8"]]) {
    await sharp(transparent).flatten({ background }).png().toFile(path.join(qaRoot, `${name}-${suffix}.png`));
  }
}

async function cropQa(sourceName, cropName, area, scale = 4) {
  await sharp(path.join(qaRoot, `${sourceName}-dark.png`))
    .extract(area)
    .resize(area.width * scale, area.height * scale, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(path.join(qaRoot, `${cropName}-${scale}x.png`));
}

await fs.mkdir(alignedRoot, { recursive: true });
await fs.mkdir(path.join(archiveRoot, "masks"), { recursive: true });
await fs.mkdir(qaRoot, { recursive: true });
const report = [];
for (const layer of layers) report.push(await alignLayer(layer));
await createModelSplit();
const grommetHoles = await createGrommetSkinBacking();
const jeansUnderModal = await createJeansUnderModal();
await compositeQa("top-modal-only", ["top-modal-grommet-skin", "top-modal-grommet"], true);
await compositeQa("top-denim-only", ["top-fitted-denim"], true);
await compositeQa("jeans-only", ["bottom-sculpted-jeans"]);
await compositeQa("top-modal-jeans", ["bottom-sculpted-jeans-under-yellow", "top-modal-grommet-skin", "top-modal-grommet"], true);
await compositeQa("top-modal-jeans-unclipped", ["bottom-sculpted-jeans", "top-modal-grommet-skin", "top-modal-grommet"], true);
await compositeQa("top-denim-jeans", ["top-fitted-denim", "bottom-sculpted-jeans"], true);
await cropQa("top-modal-jeans", "top-modal-neck-armholes", { left: 380, top: 255, width: 285, height: 245 });
await cropQa("top-modal-jeans", "top-modal-grommets", { left: 420, top: 440, width: 220, height: 205 });
await cropQa("top-modal-jeans", "top-modal-shirt-jeans-seam", { left: 300, top: 535, width: 430, height: 145 }, 3);
await cropQa("top-modal-jeans-unclipped", "top-modal-shirt-jeans-seam-unclipped", { left: 300, top: 535, width: 430, height: 145 }, 3);
await cropQa("top-denim-jeans", "top-denim-neck-armholes", { left: 380, top: 240, width: 285, height: 250 });
await cropQa("top-denim-jeans", "top-denim-shirt-jeans-seam", { left: 300, top: 525, width: 430, height: 155 }, 3);
await fs.writeFile(path.join(archiveRoot, "alignment-report.json"), `${JSON.stringify({ release, layers: report, grommetHoles, jeansUnderModal }, null, 2)}\n`);
console.log(JSON.stringify({ release, alignedRoot, qaRoot, layers: report, grommetHoles, jeansUnderModal }, null, 2));
