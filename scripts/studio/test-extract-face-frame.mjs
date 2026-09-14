import sharp from 'sharp';
import fs from 'fs';

async function extractFaceFrame() {
  const imgPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/773ef89d-f4e4-48a9-a078-34658e68db85/face_frame_template_1789193051451.jpg';
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  
  // 1. Identify outer background via flood fill from borders
  const isOuterBlack = new Uint8Array(w * h);
  const queue = [];
  
  const isBlackPixel = (x, y) => {
    const idx = (y * w + x) * 3;
    const maxVal = Math.max(data[idx], data[idx+1], data[idx+2]);
    return maxVal < 32;
  };
  
  // Seed outer edges
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
    const nbs = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
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
  
  // 2. Identify inner face hole (any black pixel that is NOT outer black)
  const isInnerHole = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!isOuterBlack[idx] && isBlackPixel(x, y)) {
        isInnerHole[idx] = 1;
      }
    }
  }
  
  // 3. Create RGBA buffer
  const outData = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx+1];
      const b = data[srcIdx+2];
      
      outData[dstIdx] = r;
      outData[dstIdx+1] = g;
      outData[dstIdx+2] = b;
      
      if (isOuterBlack[y * w + x] || isInnerHole[y * w + x]) {
        // Outer black or inner aperture: fully transparent
        outData[dstIdx+3] = 0;
      } else {
        // Smooth transition near black borders
        const maxVal = Math.max(r, g, b);
        if (maxVal < 45) {
          outData[dstIdx+3] = Math.round(((maxVal - 32) / (45 - 32)) * 255);
        } else {
          outData[dstIdx+3] = 255;
        }
      }
    }
  }
  
  await sharp(outData, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('artifacts/studio/extracted-face-frame.png');
    
  console.log('Successfully saved extracted-face-frame.png');
}

extractFaceFrame();
