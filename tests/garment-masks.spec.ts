import { expect, test } from "@playwright/test";
import sharp from "sharp";

const WIDTH = 1024;
const HEIGHT = 1536;
const MODEL_SOURCE = "assets/studio/sources/model/model-master-v2.png";

function looksLikeSkin(red: number, green: number, blue: number) {
  return red > 145 && green > 75 && blue > 45 && red - green > 28 && green - blue > 18;
}

async function readLayer(id: string) {
  return sharp(`public/game/studio/layers/${id}.png`).ensureAlpha().raw().toBuffer();
}

type Region = { minX: number; maxX: number; minY: number; maxY: number };

async function countModelSkinLeak(layer: Buffer, guaranteedFabric: Region[] = []) {
  const model = await sharp(MODEL_SOURCE).removeAlpha().raw().toBuffer();
  let leaked = 0;
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel++) {
    const layerOffset = pixel * 4;
    if (layer[layerOffset + 3] <= 32) continue;
    const modelOffset = pixel * 3;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    if (guaranteedFabric.some((region) => (
      x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY
    ))) continue;
    const red = layer[layerOffset];
    const green = layer[layerOffset + 1];
    const blue = layer[layerOffset + 2];
    const modelRed = model[modelOffset];
    const modelGreen = model[modelOffset + 1];
    const modelBlue = model[modelOffset + 2];
    const distance = Math.max(
      Math.abs(red - modelRed),
      Math.abs(green - modelGreen),
      Math.abs(blue - modelBlue),
    );
    if (
      distance < 85 &&
      looksLikeSkin(red, green, blue) &&
      looksLikeSkin(modelRed, modelGreen, modelBlue)
    ) leaked++;
  }
  return leaked;
}

test("fitted denim top has clean shoulders and a continuous antialiased edge", async () => {
  const data = await readLayer("top-fitted-denim");
  const alpha = (x: number, y: number) => data[(y * WIDTH + x) * 4 + 3];
  let shoulderPixels = 0;
  let antialiasedPixels = 0;
  for (let y = 250; y < 650; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const value = alpha(x, y);
      if ((x < 395 || x > 650) && value > 32) shoulderPixels++;
      if (value > 0 && value < 255) antialiasedPixels++;
    }
  }
  expect(shoulderPixels, "shoulders and arms must stay transparent").toBe(0);
  expect(await countModelSkinLeak(data, [{ minX: 440, maxX: 590, minY: 360, maxY: 590 }]), "model skin must not be baked into the top").toBe(0);
  expect(antialiasedPixels, "the top must retain a clean antialiased silhouette").toBeGreaterThan(800);

  let fabricHoles = 0;
  for (let y = 360; y < 590; y++) {
    for (let x = 440; x < 590; x++) if (alpha(x, y) === 0) fabricHoles++;
  }
  expect(fabricHoles, "the fitted torso must not expose the model through the denim").toBe(0);
});

test("sculpted jeans keep continuous fabric and exclude model skin", async () => {
  const data = await readLayer("bottom-sculpted-jeans");
  const alpha = (x: number, y: number) => data[(y * WIDTH + x) * 4 + 3];
  expect(await countModelSkinLeak(data, [{ minX: 405, maxX: 610, minY: 600, maxY: 710 }]), "source arms, hands, and feet must not be baked into the jeans").toBe(0);
  let fabricHoles = 0;
  for (let y = 600; y < 710; y++) {
    for (let x = 405; x < 610; x++) if (alpha(x, y) === 0) fabricHoles++;
  }
  expect(fabricHoles, "the upper pockets and seams must remain opaque").toBe(0);
});

test("modal top has transparent shoulders and no holes across its fabric", async () => {
  const data = await readLayer("top-modal-grommet");
  const alpha = (x: number, y: number) => data[(y * WIDTH + x) * 4 + 3];
  let shoulderPixels = 0;
  for (let y = 300; y < 650; y++) {
    for (let x = 350; x < 385; x++) if (alpha(x, y) > 32) shoulderPixels++;
    for (let x = 656; x < 710; x++) if (alpha(x, y) > 32) shoulderPixels++;
  }
  expect(shoulderPixels, "source shoulders and arms must stay transparent").toBe(0);
  expect(await countModelSkinLeak(data, [{ minX: 455, maxX: 565, minY: 410, maxY: 620 }]), "model skin must not be baked into the top").toBe(0);
  let fabricHoles = 0;
  for (let y = 410; y < 620; y++) {
    for (let x = 455; x < 565; x++) if (alpha(x, y) === 0) fabricHoles++;
  }
  expect(fabricHoles, "the modal fabric must not expose the model beneath it").toBe(0);
});

test("sculpted denim skirt stays opaque and excludes hands and feet", async () => {
  const data = await readLayer("bottom-denim-sculpted-skirt");
  const alpha = (x: number, y: number) => data[(y * WIDTH + x) * 4 + 3];
  expect(await countModelSkinLeak(data, [{ minX: 460, maxX: 565, minY: 650, maxY: 1200 }]), "hands and feet must not be baked into the skirt layer").toBe(0);
  let centerHoles = 0;
  for (let y = 650; y < 1200; y++) {
    for (let x = 460; x < 565; x++) if (alpha(x, y) === 0) centerHoles++;
  }
  expect(centerHoles, "the long skirt must remain opaque through the calf-covering body").toBe(0);

  let feetPixels = 0;
  for (let y = 1405; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) if (alpha(x, y) > 0) feetPixels++;
  }
  expect(feetPixels, "bare feet or toes must not be baked into the skirt layer").toBe(0);
});
