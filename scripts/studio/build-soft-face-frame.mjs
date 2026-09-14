import sharp from 'sharp';

export async function buildSoftFaceFrame() {
  const WIDTH = 1024, HEIGHT = 1536;

  // Natural V-line Face Aperture:
  // Designed specifically to fit human facial proportions and blend seamlessly
  // with character bangs, side hair strands, and jawline
  const pathD = `
    M 518 148
    C 544 146, 564 150, 569 168
    C 573 184, 567 204, 552 220
    C 540 232, 527 242, 521 245
    C 519 246.5, 515 246.5, 513 245
    C 507 242, 494 232, 482 220
    C 467 204, 461 184, 465 168
    C 470 150, 490 146, 518 148
    Z
  `;

  // Create an SVG mask with soft Gaussian blur (stdDeviation: 5.5) for silky anti-aliased feathering
  const svgMask = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
      </defs>
      <path d="${pathD}" fill="white" filter="url(#softGlow)" />
    </svg>
  `;

  const maskBuffer = await sharp(Buffer.from(svgMask))
    .resize(WIDTH, HEIGHT)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const upper = await sharp('public/game/studio/layers/model-upper.png')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = Buffer.from(upper.data);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const p = (y * WIDTH + x) * 4;
      const maskP = (y * WIDTH + x) * maskBuffer.info.channels;
      const maskVal = maskBuffer.data[maskP]; // 0 = keep, 255 = hollow

      // Remove neck completely below chin in center so doll neck shows from layer 0
      if (y >= 246 && x >= 420 && x <= 620) {
        data[p + 3] = 0;
        continue;
      }
      // Remove body below shoulders from overlay
      if (y >= 265) {
        data[p + 3] = 0;
        continue;
      }

      if (maskVal > 0) {
        // Smooth continuous S-curve falloff
        const norm = maskVal / 255;
        const factor = 1 - Math.min(1.0, norm * norm * (3 - 2 * norm)); // Smoothstep
        data[p + 3] = Math.round(data[p + 3] * factor);
      }
    }
  }

  // Save the pre-formed hollow asset
  await sharp(data, { raw: upper.info })
    .png()
    .toFile('public/game/studio/layers/model-hair-hat-overlay.png');

  // Save tight crop for camera modal (380x300 centered on character head)
  await sharp('public/game/studio/layers/model-hair-hat-overlay.png')
    .extract({ left: 328, top: 10, width: 380, height: 300 })
    .png()
    .toFile('public/game/studio/layers/face-cam-overlay-tight.png');

  console.log('Successfully generated smooth pre-formed hollow face frame assets');
}

buildSoftFaceFrame().catch(console.error);
