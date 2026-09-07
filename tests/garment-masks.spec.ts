import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("sculpted jeans keep continuous fabric and exclude the source arms", async () => {
  const data = await sharp("public/game/studio/layers/bottom-sculpted-jeans.png").ensureAlpha().raw().toBuffer();
  const alpha = (x: number, y: number) => data[(y * 1024 + x) * 4 + 3];
  let strayPixels = 0;
  for (const [left, top, width, height] of [[325, 610, 30, 100], [660, 590, 40, 140], [320, 790, 35, 50]]) {
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) if (alpha(x, y)) strayPixels++;
    }
  }
  expect(strayPixels, "source arms/hands must not be baked into the jeans").toBe(0);
  let fabricHoles = 0;
  for (let y = 635; y < 710; y++) {
    for (let x = 405; x < 610; x++) if (alpha(x, y) !== 255) fabricHoles++;
  }
  expect(fabricHoles, "the upper pockets and seams must remain opaque").toBe(0);
});

test("modal top has no detached arm pixels or holes across its fabric", async () => {
  const data = await sharp("public/game/studio/layers/top-modal-grommet.png").ensureAlpha().raw().toBuffer();
  const alpha = (x: number, y: number) => data[(y * 1024 + x) * 4 + 3];
  let strayPixels = 0;
  for (let y = 350; y < 620; y++) {
    for (let x = 350; x < 395; x++) if (alpha(x, y)) strayPixels++;
    for (let x = 621; x < 670; x++) if (alpha(x, y)) strayPixels++;
  }
  expect(strayPixels, "source arm and hip contours must stay transparent").toBe(0);
  let fabricHoles = 0;
  for (let y = 410; y < 570; y++) {
    for (let x = 455; x < 565; x++) if (alpha(x, y) !== 255) fabricHoles++;
  }
  expect(fabricHoles, "the modal fabric must not expose the model beneath it").toBe(0);
});

test("sculpted denim skirt stays opaque through the calves and excludes hands", async () => {
  const data = await sharp("public/game/studio/layers/bottom-denim-sculpted-skirt.png").ensureAlpha().raw().toBuffer();
  const alpha = (x: number, y: number) => data[(y * 1024 + x) * 4 + 3];
  let handPixels = 0;
  for (const [left, right] of [[320, 370], [650, 704]]) {
    for (let y = 690; y < 860; y++) for (let x = left; x < right; x++) if (alpha(x, y) > 32) handPixels++;
  }
  expect(handPixels, "hands must not be baked into the skirt layer").toBe(0);
  let centerHoles = 0;
  for (let y = 650; y < 1200; y++) for (let x = 460; x < 565; x++) if (alpha(x, y) !== 255) centerHoles++;
  expect(centerHoles, "the long skirt must remain opaque through the calf-covering body").toBe(0);
});
