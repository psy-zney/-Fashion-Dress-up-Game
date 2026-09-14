import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const STAGE = { width: 1024, height: 1536 };
const RELEASE = "artifacts/studio/candidates/2026-09-13-face-compose-v1";
const SOURCES = {
  denim: "assets/studio/user-cutouts/2026-09-13-face-compose-v1/generated/foreground-arms-denim-black.png",
  modal: "assets/studio/user-cutouts/2026-09-13-face-compose-v1/generated/foreground-arms-modal-black.png",
};

const PLACEMENTS = {
  denim: { left: 157, top: 78, width: 711, height: 330, clip: { left: 310, top: 55, width: 405, height: 210 } },
  modal: { left: 154, top: 78, width: 662, height: 500, clip: { left: 295, top: 55, width: 240, height: 115 } },
};

async function removeBlackBackground(sourcePath) {
  const { data, info } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const sourceOffset = pixel * info.channels;
    const targetOffset = pixel * 4;
    const r = data[sourceOffset];
    const g = data[sourceOffset + 1];
    const b = data[sourceOffset + 2];
    const max = Math.max(r, g, b);
    const alpha = max <= 5 ? 0 : max >= 28 ? 255 : Math.round((max - 5) / 23 * 255);

    // Remove the black matte from partially covered edge pixels.
    const unmatte = alpha > 0 && alpha < 255 ? 255 / alpha : 1;
    rgba[targetOffset] = Math.min(255, Math.round(r * unmatte));
    rgba[targetOffset + 1] = Math.min(255, Math.round(g * unmatte));
    rgba[targetOffset + 2] = Math.min(255, Math.round(b * unmatte));
    rgba[targetOffset + 3] = alpha;
  }

  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function buildVariant(variant, runtimeId) {
  const placement = PLACEMENTS[variant];
  const transparent = await removeBlackBackground(SOURCES[variant]);
  const trimmed = await sharp(transparent).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const resized = await sharp(trimmed)
    .resize({ width: placement.width, height: placement.height, fit: "fill" })
    .png()
    .toBuffer();

  const staged = await sharp({
    create: {
      width: STAGE.width,
      height: STAGE.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: resized, left: placement.left, top: placement.top }]).png().toBuffer();

  const clip = Buffer.from(
    '<svg width="' + STAGE.width + '" height="' + STAGE.height + '" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="' + placement.clip.left + '" y="' + placement.clip.top + '" width="' + placement.clip.width +
    '" height="' + placement.clip.height + '" rx="26" fill="white"/></svg>',
  );
  const foreground = await sharp(staged)
    .composite([{ input: clip, blend: "dest-in" }])
    .png()
    .toBuffer();

  const outputPath = path.join(RELEASE, "layers/" + runtimeId + ".png");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(foreground).toFile(outputPath);

  for (const [name, background] of [["charcoal", "#202725"], ["mint", "#9ff3d2"]]) {
    await sharp(foreground)
      .flatten({ background })
      .resize({ width: 512 })
      .png()
      .toFile(path.join(RELEASE, "qa/" + runtimeId + "-" + name + ".png"));
  }
}

await fs.mkdir(path.join(RELEASE, "qa"), { recursive: true });
await buildVariant("denim", "top-fitted-denim-pose-hands");
await buildVariant("modal", "top-modal-grommet-pose-hands");
console.log("Built showcase hand candidates in " + RELEASE);
