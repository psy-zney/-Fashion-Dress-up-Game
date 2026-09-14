import sharp from 'sharp';

async function testCompositeOnModel() {
  const modelUpper = sharp('public/game/studio/layers/model-upper.png');
  const frameImg = sharp('artifacts/studio/extracted-face-frame.png');
  
  // Let's get metadata of the frame
  const frameMeta = await frameImg.metadata();
  console.log('Frame size:', frameMeta.width, frameMeta.height);
  
  // Crop frame tightly first to see its true dimensions
  const trimmedBuffer = await sharp('artifacts/studio/extracted-face-frame.png')
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });
    
  console.log('Trimmed frame bbox/size:', trimmedBuffer.info.width, trimmedBuffer.info.height, trimmedBuffer.info.trimOffsetTop, trimmedBuffer.info.trimOffsetLeft);
  
  // Let's inspect the model upper head position:
  // In previous inspection:
  // Original overlay was minX: 408, maxX: 602, minY: 26, maxY: 245
  // Original width: 194px, height: 219px.
  // The new frame trimmed width is ~708px, height: 855px.
  // If we scale trimmed frame to width ~220px:
  const targetWidth = 230; // slightly fuller for lush hair
  const scale = targetWidth / trimmedBuffer.info.width;
  const targetHeight = Math.round(trimmedBuffer.info.height * scale);
  
  console.log('Scaled dimensions:', targetWidth, targetHeight);
  
  const resizedFrame = await sharp(trimmedBuffer.data)
    .resize(targetWidth, targetHeight, { fit: 'contain' })
    .toBuffer();
    
  // Position on 1024x1536:
  // Center X = 512. Left = 512 - targetWidth/2 = 512 - 115 = 397
  // Top Y: Chin in original was at y=245.
  // Let's check where the chin is in resizedFrame.
  // In 855h, chin is around y=760. 760 * scale ≈ 246!
  // So top Y should be around y = 246 - (760 * scale) ≈ 246 - 246 = 0 or 15!
  const left = 396;
  const top = 10;
  
  const composite = await sharp('public/game/studio/layers/model-upper.png')
    .composite([
      {
        input: resizedFrame,
        left: left,
        top: top,
      }
    ])
    .png()
    .toFile('artifacts/studio/composite-model-head.png');
    
  console.log('Saved composite-model-head.png');
}

testCompositeOnModel();
