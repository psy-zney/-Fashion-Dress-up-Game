import sharp from 'sharp';
import fs from 'fs';

export async function buildGeminiFaceFrame() {
  const sourcePath = 'assets/studio/sources/gemini-face-frame-original.jpg';
  const { data, info } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  // 1. Identify outer background via flood fill from borders
  const isOuterBlack = new Uint8Array(w * h);
  const queue = [];

  const isBlackPixel = (x, y) => {
    const idx = (y * w + x) * 3;
    const maxVal = Math.max(data[idx], data[idx + 1], data[idx + 2]);
    return maxVal < 32;
  };

  // Seed border pixels
  for (let x = 0; x < w; x++) {
    if (isBlackPixel(x, 0)) { isOuterBlack[x] = 1; queue.push(x, 0); }
    if (isBlackPixel(x, h - 1)) { isOuterBlack[(h - 1) * w + x] = 1; queue.push(x, h - 1); }
  }
  for (let y = 0; y < h; y++) {
    if (isBlackPixel(0, y)) { isOuterBlack[y * w] = 1; queue.push(0, y); }
    if (isBlackPixel(w - 1, y)) { isOuterBlack[y * w + (w - 1)] = 1; queue.push(w - 1, y); }
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    const nbs = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of nbs) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const idx = ny * w + nx;
        if (!isOuterBlack[idx] && isBlackPixel(nx, ny)) {
          isOuterBlack[idx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // 2. Identify inner face hole (black pixel inside the character headpiece)
  const isInnerHole = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!isOuterBlack[idx] && isBlackPixel(x, y)) {
        isInnerHole[idx] = 1;
      }
    }
  }

  // 3. Create initial RGBA buffer with soft edge falloff
  const rawRgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      rawRgba[dstIdx] = r;
      rawRgba[dstIdx + 1] = g;
      rawRgba[dstIdx + 2] = b;

      // Check fake peach forehead above cyan glasses
      const isForeheadRegion = x > 490 && x < 630 && y > 330 && y < 430;
      const isSkin = r > 165 && g > 130 && b > 110;
      const isCap = r > 220 && g > 220 && b > 220;

      if (isOuterBlack[y * w + x] || isInnerHole[y * w + x] || (isForeheadRegion && isSkin && !isCap)) {
        rawRgba[dstIdx + 3] = 0;
      } else {
        const maxVal = Math.max(r, g, b);
        if (maxVal < 42) {
          rawRgba[dstIdx + 3] = Math.round(((maxVal - 32) / (42 - 32)) * 255);
        } else {
          rawRgba[dstIdx + 3] = 255;
        }
      }
    }
  }

  // Convert raw RGBA to PNG buffer first
  const fullPng = await sharp(rawRgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  // 4. Extract and trim the headpiece
  const trimmed = await sharp(fullPng)
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });

  // 5. Scale to fit game character head & neck coordinates:
  // Target height 246px, chin sits at y=237, cap top at y=18, leaving clear neck in both denim & modal poses
  const targetH = 246;
  const scale = targetH / trimmed.info.height;
  const targetW = Math.round(trimmed.info.width * scale);

  const resized = await sharp(trimmed.data)
    .resize(targetW, targetH)
    .png()
    .toBuffer();

  const left = Math.round(512 - targetW / 2);
  const top = 18;

  // 6. Composite into 1024x1536 stage canvas
  const fullOverlay = await sharp({
    create: {
      width: 1024,
      height: 1536,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

  // 7. Extract tight 380x300 modal viewport crop centered on face aperture
  const modalLeft = 322;
  const modalTop = 1;
  const tightOverlay = await sharp(fullOverlay)
    .extract({ left: modalLeft, top: modalTop, width: 380, height: 300 })
    .png()
    .toBuffer();

  // 8. Generate clean pose-swap layers (clearing the doll's inner face features so they never clash/leak behind the aperture)
  for (const name of ['top-fitted-denim-pose', 'top-modal-grommet-pose']) {
    const { data: poseData, info: poseInfo } = await sharp('public/game/studio/layers/' + name + '.png').raw().toBuffer({ resolveWithObject: true });
    const pw = poseInfo.width, ph = poseInfo.height;
    const poseBuf = Buffer.from(poseData);

    // Feathered cutout of inner facial features: x: 445-579, y: 115-238
    for (let y = 115; y <= 238; y++) {
      for (let x = 445; x <= 579; x++) {
        const distLeft = x - 445, distRight = 579 - x;
        const distTop = y - 115, distBottom = 238 - y;
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const idx = (y * pw + x) * 4;
        if (minDist >= 5) {
          poseBuf[idx + 3] = 0;
        } else {
          const factor = minDist / 5;
          poseBuf[idx + 3] = Math.round(poseBuf[idx + 3] * (1 - factor));
        }
      }
    }

    const swapPng = await sharp(poseBuf, { raw: { width: pw, height: ph, channels: 4 } }).png().toBuffer();
    await sharp(swapPng).toFile(`artifacts/studio/candidate-${name}-swap.png`);
    await sharp(swapPng).toFile(`public/game/studio/layers/${name}-swap.png`);
  }

  // 9. Write candidate files first (Pipeline rule)
  await sharp(fullOverlay).toFile('artifacts/studio/candidate-model-hair-hat-overlay.png');
  await sharp(tightOverlay).toFile('artifacts/studio/candidate-face-cam-overlay-tight.png');

  // 10. Write runtime layers
  await sharp(fullOverlay).toFile('public/game/studio/layers/model-hair-hat-overlay.png');
  await sharp(tightOverlay).toFile('public/game/studio/layers/face-cam-overlay-tight.png');

  console.log('Successfully built proportional Gemini face frame overlays & pose-swap layers (neck preserved, zero overlap clash):');
  console.log('- public/game/studio/layers/model-hair-hat-overlay.png (1024x1536)');
  console.log('- public/game/studio/layers/face-cam-overlay-tight.png (380x300)');
  console.log('- public/game/studio/layers/top-fitted-denim-pose-swap.png');
  console.log('- public/game/studio/layers/top-modal-grommet-pose-swap.png');
}

buildGeminiFaceFrame().catch(console.error);
