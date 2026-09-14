import sharp from "sharp";

export async function generateFaceOverlays() {
  const WIDTH = 1024, HEIGHT = 1536;

  // Refined Fashion V-line Face Path that hugs bangs, hair frame, and V-jawline:
  // Forehead: curves under the bangs (y=154 at x=485, y=148 at x=520, y=144 at x=550)
  // Cheeks: hugs inside the hair frame
  // Jaw: sleek V-line down to y=246.5
  const pathD = `
    M 518 147
    C 542 145, 564 148, 570 166
    C 574 182, 568 202, 554 218
    C 542 230, 528 240, 521 245
    C 519 246.5, 515 246.5, 513 245
    C 506 240, 492 230, 480 218
    C 466 202, 460 182, 464 166
    C 468 152, 492 149, 518 147
    Z
  `;

  const svgMask = Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="white" />
    </svg>
  `);

  const maskImg = await sharp(svgMask).resize(WIDTH, HEIGHT).blur(1.2).toBuffer();
  const maskRaw = await sharp(maskImg).raw().toBuffer({ resolveWithObject: true });

  const upper = await sharp("public/game/studio/layers/model-upper.png").raw().toBuffer({ resolveWithObject: true });
  const overlay = Buffer.from(upper.data);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const p = (y * WIDTH + x) * 4;
      const maskP = (y * WIDTH + x) * maskRaw.info.channels;
      const maskVal = maskRaw.data[maskP];

      // Remove neck skin completely below chin so neck is never covered by overlay
      if (y >= 246 && x >= 420 && x <= 620) {
        overlay[p + 3] = 0;
        continue;
      }
      // Remove body below shoulders from overlay (game stage layer 0 has model body)
      if (y >= 265) {
        overlay[p + 3] = 0;
        continue;
      }

      if (maskVal > 0) {
        const factor = 1 - (maskVal / 255);
        overlay[p + 3] = Math.round(overlay[p + 3] * factor);
      }
    }
  }

  await sharp(overlay, { raw: upper.info })
    .png()
    .toFile("public/game/studio/layers/model-hair-hat-overlay.png");

  // Tight crop for camera modal:
  // center on x=518, y=160, width: 380, height: 300
  // left: 518 - 190 = 328, top: 160 - 150 = 10
  await sharp("public/game/studio/layers/model-hair-hat-overlay.png")
    .extract({ left: 328, top: 10, width: 380, height: 300 })
    .png()
    .toFile("public/game/studio/layers/face-cam-overlay-tight.png");

  console.log("Successfully generated V-line model-hair-hat-overlay.png and face-cam-overlay-tight.png");
}

generateFaceOverlays();
