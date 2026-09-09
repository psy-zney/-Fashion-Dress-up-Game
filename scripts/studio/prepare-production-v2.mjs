import fs from 'node:fs/promises';
import sharp from 'sharp';

const root = 'assets/studio/manual-extraction/production-v2-white';
const out = 'public/game/studio/layers';
const qa = 'artifacts/studio/qa/production-v2';
const W = 1024, H = 1536, N = W * H;
const source = (name) => `${root}/item/${name}-White-Background.png`;
await fs.mkdir(qa, { recursive: true });
await fs.mkdir(`${root}/cutouts`, { recursive: true });
const read = (file) => sharp(file).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const isWhite = (r, g, b) => Math.min(r, g, b) > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
async function pathMask(d) {
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="white"/></svg>`)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
}
const hat = await pathMask('M444 83 C449 67 462 53 479 39 C491 32 508 34 522 34 L570 66 Q586 82 588 118 L565 103 L450 91 Z');
const bodyLower = await pathMask('M435 538 Q431 572 410 613 Q383 677 376 737 Q372 785 381 834 L665 835 Q675 778 668 732 Q661 669 644 620 Q619 567 611 538 Z M370 832H680V1536H370Z');
const neckline = await pathMask('M466 274 Q478 327 521 373 Q566 336 586 275 Q549 295 526 294 Q493 294 466 274Z');
const yellowShape = await pathMask('M437 281 Q451 279 465 272 Q478 329 521 375 Q569 338 587 274 Q604 281 616 284 Q613 339 635 404 Q632 457 619 495 Q610 531 618 561 Q633 609 655 654 Q528 677 394 646 Q406 608 424 570 Q435 552 431 538 Q432 501 423 469 Q408 421 413 395 Q443 334 437 281 Z');
const armsShape = await pathMask('M350 280 L437 280 Q445 340 413 409 L410 484 Q415 525 400 556 L369 721 L381 881 L300 885 L300 699 L333 530 Z M615 280 L697 280 L706 524 L740 759 L740 885 L668 885 L675 746 L670 670 L653 620 L647 598 L636 550 Q622 516 630 485 L630 415 Q605 346 615 280 Z');
const protectedHead = (x, y) => hat[y * W + x] > 0 || (x > 460 && x < 580 && y > 130 && y < 237);
function rowSpanMask(rgb, predicate, minY, maxY, clip, padding = 0) {
  const mask = Buffer.alloc(N);
  const spans = [];
  for (let y = minY; y <= maxY; y++) {
    let left = W, right = -1;
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      if (predicate(rgb[p], rgb[p + 1], rgb[p + 2], x, y)) { left = Math.min(left, x); right = x; }
    }
    spans[y] = right >= left ? { left, right } : null;
  }
  for (let y = minY; y <= maxY; y++) {
    if (!spans[y]) {
      let before = y - 1, after = y + 1;
      while (before >= minY && !spans[before]) before--;
      while (after <= maxY && !spans[after]) after++;
      if (before >= minY && after <= maxY && spans[before] && spans[after]) {
        const ratio = (y - before) / (after - before);
        spans[y] = {
          left: Math.round(spans[before].left * (1 - ratio) + spans[after].left * ratio),
          right: Math.round(spans[before].right * (1 - ratio) + spans[after].right * ratio),
        };
      }
    }
  }
  const smoothed = spans.map((span, y) => {
    if (!span || y < minY || y > maxY) return span;
    const nearby = spans.slice(Math.max(minY, y - 5), Math.min(maxY + 1, y + 6)).filter(Boolean);
    const median = (key) => nearby.map(candidate => candidate[key]).sort((a, b) => a - b)[Math.floor(nearby.length / 2)];
    return { left: median('left'), right: median('right') };
  });
  for (let y = minY; y <= maxY; y++) {
    const span = smoothed[y];
    if (!span) continue;
    for (let x = Math.max(0, span.left - padding); x <= Math.min(W - 1, span.right + padding); x++) {
      if (!clip || clip[y * W + x]) mask[y * W + x] = 255;
    }
  }
  return mask;
}
function repairMaskedPixels(rgb, mask, invalid, maximumDistance = 48) {
  const repaired = Buffer.from(rgb);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, k = p * 3;
    if (!mask[p] || !invalid(rgb[k], rgb[k + 1], rgb[k + 2])) continue;
    for (let distance = 1; distance <= maximumDistance; distance++) {
      const candidates = [x - distance, x + distance];
      const donorX = candidates.find(candidate => {
        if (candidate < 0 || candidate >= W || !mask[y * W + candidate]) return false;
        const donor = (y * W + candidate) * 3;
        return !invalid(rgb[donor], rgb[donor + 1], rgb[donor + 2]);
      });
      if (donorX === undefined) continue;
      const donor = (y * W + donorX) * 3;
      repaired[k] = rgb[donor]; repaired[k + 1] = rgb[donor + 1]; repaired[k + 2] = rgb[donor + 2];
      break;
    }
  }
  return repaired;
}

// Remove disconnected specks; fill enclosed holes without closing arm/leg gaps.
function clean(mask, minSize = 30, fillHoles = true) {
  const seen = new Uint8Array(N), queue = new Int32Array(N);
  for (let seed = 0; seed < N; seed++) {
    if (seen[seed]) continue;
    const value = mask[seed];
    let head = 0, tail = 1, edge = false;
    queue[0] = seed; seen[seed] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % W, y = Math.floor(p / W);
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) edge = true;
      for (const q of [x ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || seen[q] || mask[q] !== value) continue;
        seen[q] = 1; queue[tail++] = q;
      }
    }
    if ((value && tail < minSize) || (fillHoles && !value && !edge && tail < 12000)) {
      for (let i = 0; i < tail; i++) mask[queue[i]] = value ? 0 : 255;
    }
  }
  return mask;
}

async function cut(rgb, predicate, { fill = true, close = false, shape } = {}) {
  let binary = Buffer.alloc(N);
  for (let p = 0; p < N; p++) {
    const k = p * 3;
    binary[p] = predicate(rgb[k], rgb[k + 1], rgb[k + 2], p % W, Math.floor(p / W)) ? 255 : 0;
  }
  clean(binary, 12, fill);
  if (close) binary = await sharp(binary, { raw: { width: W, height: H, channels: 1 } }).dilate(2).erode(2).toColourspace('b-w').raw().toBuffer();
  if (shape) binary = Buffer.from(shape);
  const alpha = await sharp(binary, { raw: { width: W, height: H, channels: 1 } }).blur(0.7).toColourspace('b-w').raw().toBuffer();
  // libvips morphology treats black as foreground: dilate shrinks our white matte.
  const interior = await sharp(binary, { raw: { width: W, height: H, channels: 1 } }).dilate(2).toColourspace('b-w').raw().toBuffer();
  const rgba = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) {
    const a = Math.max(0, Math.round((alpha[p] - 20) * 255 / 235));
    if (a < 5) continue;
    const x = p % W, y = Math.floor(p / W);
    let donor = p, best = 99;
    if (a < 254 || interior[p] < 254) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const q = p + dy * W + dx, distance = dx * dx + dy * dy;
        if (x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H) continue;
        if (interior[q] >= 254 && distance < best) { donor = q; best = distance; }
      }
    }
    for (let c = 0; c < 3; c++) rgba[p * 4 + c] = rgb[donor * 3 + c];
    rgba[p * 4 + 3] = a > 250 ? 255 : a;
  }
  return rgba;
}
async function save(id, rgba, preview = false) {
  const image = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
  await image.png().toFile(`${out}/${id}.png`);
  await image.clone().trim({ threshold: 0 }).png().toFile(`${root}/cutouts/${id}.png`);
  if (preview) {
    const previewPath = `public/game/studio/products/${id}.png`;
    try {
      await fs.access(previewPath);
      if (process.env.OVERWRITE_PRODUCTS === 'true') {
        await image.clone().trim({ threshold: 0 }).resize(480, 640, { fit: 'contain', background: '#00000000' })
          .extend({ top: 30, bottom: 30, left: 30, right: 30, background: '#00000000' }).png().toFile(previewPath);
      }
    } catch {
      await image.clone().trim({ threshold: 0 }).resize(480, 640, { fit: 'contain', background: '#00000000' })
        .extend({ top: 30, bottom: 30, left: 30, right: 30, background: '#00000000' }).png().toFile(previewPath);
    }
  }
  await image.clone().flatten({ background: '#24212e' }).resize(512).png().toFile(`${qa}/${id}-dark.png`);
}
function punchHoles(rgba, holes) {
  for (const { x: centerX, y: centerY, radius } of holes) {
    for (let y = centerY - radius - 2; y <= centerY + radius + 2; y++) for (let x = centerX - radius - 2; x <= centerX + radius + 2; x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      const coverage = Math.max(0, Math.min(1, distance - radius + 1));
      const p = (y * W + x) * 4;
      rgba[p + 3] = Math.round(rgba[p + 3] * coverage);
    }
  }
  return rgba;
}
const grommetHoles = [
  { x: 465, y: 543, radius: 14 },
  { x: 608, y: 470, radius: 6 },
  { x: 440, y: 622, radius: 6 },
];

const neutralRgb = await read(source('00-Party-Model-Base'));
const baseRgb = Buffer.from(neutralRgb);
// Use the approved source directly. Generated variants altered seams and edge pixels.
const yellowRgb = await read(source('02-Modal-Grommet-Top'));
for (let p = 0; p < N; p++) if (neckline[p]) {
  const a = neckline[p] / 255;
  for (let c = 0; c < 3; c++) baseRgb[p * 3 + c] = Math.round(baseRgb[p * 3 + c] * (1 - a) + yellowRgb[p * 3 + c] * a);
}
const base = await cut(baseRgb, (r, g, b, x, y) => (!isWhite(r, g, b) || protectedHead(x, y)) && x > 295 && x < 740 && y > 20 && y < 1510, { fill: false });
await save('model', base);
const arms = Buffer.from(base);
for (let p = 0; p < N; p++) {
  const x = p % W, y = Math.floor(p / W);
  let outsideTorso = true;
  if (y >= 525 && y < 620) outsideTorso = x < 405 || x > 647;
  else if (y >= 620 && y < 670) outsideTorso = x < 387 || x > 670;
  else if (y >= 670 && y < 720) outsideTorso = x < 380 || x > 673;
  else if (y >= 720 && y < 880) outsideTorso = x < 375 || x > (y > 760 ? 666 : 672);
  arms[p * 4 + 3] = outsideTorso ? Math.round(arms[p * 4 + 3] * armsShape[p] / 255) : 0;
}
await save('model-arms', arms);
const bootsBase = Buffer.from(base);
for (let p = 0; p < N; p++) if (Math.floor(p / W) > 1242) bootsBase[p * 4 + 3] = 0;
await save('model-boots', bootsBase);

const denimRgb = await read(source('01-Fitted-Denim-Top'));
const denimMask = rowSpanMask(denimRgb, (r, g, b, x, y) => x > (y < 280 ? 465 : 395) && x < (y < 280 ? 580 : 650) && r < 155 && b >= r * 0.94 && b > 25, 251, 635);
const denimRepairedRgb = repairMaskedPixels(denimRgb, denimMask, (r, g, b) => isWhite(r, g, b) || (r > 170 && g > 100 && b > 75 && r - g > 25));
const denim = await cut(denimRepairedRgb, () => true, { shape: denimMask });
await save('top-fitted-denim', denim, true);
const yellowMask = rowSpanMask(
  yellowRgb,
  (r, g, b, x, y) => x > 390 && x < 660 && y > 270 && y < 660 && g > r + 3 && g > b * 1.15,
  272,
  655,
  yellowShape,
  1,
);
const isYellowContaminant = (r, g, b) => isWhite(r, g, b) || (r > 170 && g > 100 && b > 75 && r - g > 25);
const yellowRepairedRgb = repairMaskedPixels(yellowRgb, yellowMask, isYellowContaminant);
const yellowCut = await cut(yellowRepairedRgb, () => true, { shape: yellowMask });
// Preserve every safe opaque source pixel exactly; edge donors are used only for
// anti-aliased pixels and source pixels identified as background or skin.
for (let p = 0; p < N; p++) {
  const sourcePixel = p * 3, outputPixel = p * 4;
  if (yellowCut[outputPixel + 3] !== 255 || isYellowContaminant(yellowRgb[sourcePixel], yellowRgb[sourcePixel + 1], yellowRgb[sourcePixel + 2])) continue;
  yellowCut[outputPixel] = yellowRgb[sourcePixel];
  yellowCut[outputPixel + 1] = yellowRgb[sourcePixel + 1];
  yellowCut[outputPixel + 2] = yellowRgb[sourcePixel + 2];
}
const yellow = punchHoles(yellowCut, grommetHoles);
await save('top-modal-grommet', yellow, true);

const jeansRgb = await read(`${root}/generated/jeans-uncovered.png`);
const jeans = await cut(jeansRgb, (r, g, b, x, y) => x > 278 && x < 792 && y > 540 && y < 1444 && !isWhite(r, g, b), { fill: false });
await save('bottom-sculpted-jeans', jeans, true);
// The modal top is worn outside the jeans. Crop the jeans to the actual curved
// hem so its waistband and hip wedges cannot rise beside or through the shirt.
const yellowHem = new Int16Array(W).fill(-1);
for (let x = 0; x < W; x++) for (let y = 500; y < 700; y++) {
  if (yellow[(y * W + x) * 4 + 3] > 32) yellowHem[x] = y;
}
const firstHemX = yellowHem.findIndex(y => y >= 0);
let lastHemX = W - 1;
while (lastHemX >= 0 && yellowHem[lastHemX] < 0) lastHemX--;
for (let x = 0; x < W; x++) {
  if (yellowHem[x] >= 0) continue;
  if (x < firstHemX) yellowHem[x] = yellowHem[firstHemX];
  else if (x > lastHemX) yellowHem[x] = yellowHem[lastHemX];
  else {
    let left = x - 1, right = x + 1;
    while (left >= firstHemX && yellowHem[left] < 0) left--;
    while (right <= lastHemX && yellowHem[right] < 0) right++;
    yellowHem[x] = Math.round((yellowHem[left] + yellowHem[right]) / 2);
  }
}
const jeansUnderYellow = Buffer.from(jeans);
for (let p = 0; p < N; p++) {
  const x = p % W, y = Math.floor(p / W);
  if (y < yellowHem[x]) jeansUnderYellow[p * 4 + 3] = 0;
}
await save('bottom-sculpted-jeans-under-yellow', jeansUnderYellow);
const bootsRgb = await read(source('05-Colorblock-Party-Platform-Boots'));
const boots = await cut(bootsRgb, (r, g, b, x, y) => {
  const top = x < 520 ? 1245 - (x - 407) * 8 / 72 : 1237 + (x - 558) * 8 / 70;
  return x > 390 && x < 643 && y >= top && y < 1503 && !isWhite(r, g, b) && (g > r || b > g || (r > g * 1.22 && g < b * 1.16) || (r > 130 && g > 110 && b < g * 0.7));
});
await save('shoes-party-platform-boots', boots, true);

// A pose replaces only the upper body. The source legs remain pixel-identical.
for (const [name, rgba] of [['model-lower', base], ['model-lower-boots', bootsBase]]) {
  const lower = Buffer.from(rgba);
  for (let p = 0; p < N; p++) {
    const x = p % W, y = Math.floor(p / W);
    lower[p * 4 + 3] = Math.round(lower[p * 4 + 3] * bodyLower[p] / 255);
  }
  await save(name, lower);
}

for (const top of ['top-fitted-denim', 'top-modal-grommet']) {
  const file = `${root}/generated/${top}-pose.png`;
  try {
    const rgb = await read(file);
    let pose = await cut(rgb, (r, g, b, x, y) => {
      if (y <= 20 || y >= 668 || (isWhite(r, g, b) && !protectedHead(x, y))) return false;
      if (top === 'top-modal-grommet') return y < 640 || yellowShape[y * W + x] > 0 || x > 664;
      return y < 610 || (b >= r * 0.94 && r < 155);
    }, { fill: false });
    if (top === 'top-modal-grommet') pose = punchHoles(pose, grommetHoles);
    await save(`${top}-pose`, pose);
  } catch (error) { if (error.code !== 'ENOENT' && !error.message.includes('Input file is missing')) throw error; }
}

for (const top of ['top-fitted-denim', 'top-modal-grommet']) {
  const isTucked = top === 'top-fitted-denim';
  const compositeLayers = [
    { input: `${out}/shoes-party-platform-boots.png` },
    ...(isTucked
      ? [{ input: `${out}/${top}.png` }, { input: `${out}/bottom-sculpted-jeans.png` }]
      : [{ input: `${out}/bottom-sculpted-jeans-under-yellow.png` }, { input: `${out}/${top}.png` }]),
    { input: `${out}/model-arms.png` },
  ];
  const composite = await sharp(`${out}/model-boots.png`).composite(compositeLayers).png().toBuffer();
  await sharp(composite).flatten({ background: '#24212e' }).resize(600).png().toFile(`${qa}/${top}-look.png`);
  const posedLayers = [
    { input: `${out}/shoes-party-platform-boots.png` },
    ...(isTucked
      ? [{ input: `${out}/${top}-pose.png` }, { input: `${out}/bottom-sculpted-jeans.png` }]
      : [{ input: `${out}/bottom-sculpted-jeans-under-yellow.png` }, { input: `${out}/${top}-pose.png` }]),
  ];
  const posed = await sharp(`${out}/model-lower-boots.png`).composite(posedLayers).png().toBuffer();
  await sharp(posed).flatten({ background: '#24212e' }).resize(600).png().toFile(`${qa}/${top}-posed-look.png`);
}
console.log(`Production v2 layers and dark-background proofs written to ${out} and ${qa}`);
const previous = JSON.parse(await fs.readFile(`${out}/ready.json`, 'utf8'));
const items = previous.items.filter(({ id }) => id !== 'bottom-denim-sculpted-skirt' && id !== 'shoes-mary-janes');
await fs.writeFile(`${out}/ready.json`, JSON.stringify({ version: 'production-v2-20260909-v12-yellow-over-waistband', catalogGarments: items.length, items, poses: ['top-fitted-denim-pose', 'top-modal-grommet-pose'], variants: ['bottom-sculpted-jeans-under-yellow'], updatedAt: new Date().toISOString() }, null, 2) + '\n');
const report = [];
for (const item of items) {
  const rgba = await sharp(`${out}/${item.id}.png`).ensureAlpha().raw().toBuffer();
  let left = W, top = H, right = 0, bottom = 0, visiblePixels = 0, antialiasedPixels = 0;
  for (let p = 0; p < N; p++) {
    const a = rgba[p * 4 + 3];
    if (!a) continue;
    const x = p % W, y = Math.floor(p / W);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    visiblePixels++; if (a < 255) antialiasedPixels++;
  }
  report.push({ ...item, width: W, height: H, hasAlpha: true, bounds: { left, top, width: right - left + 1, height: bottom - top + 1, visiblePixels }, antialiasedPixels });
}
await fs.writeFile(`${out}/asset-report.json`, JSON.stringify(report, null, 2) + '\n');
