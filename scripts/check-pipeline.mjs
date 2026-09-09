import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { assertProductsUnchanged } from "./studio/product-lock.mjs";

const REQUIRED_LAYERS = [
  "model",
  "model-arms",
  "model-boots",
  "model-lower",
  "model-lower-boots",
  "top-fitted-denim",
  "top-fitted-denim-pose",
  "top-modal-grommet",
  "top-modal-grommet-pose",
  "bottom-sculpted-jeans",
  "shoes-party-platform-boots",
];

const REQUIRED_PRODUCTS = [
  "top-fitted-denim",
  "top-modal-grommet",
  "bottom-sculpted-jeans",
  "shoes-party-platform-boots",
];

const STAGE_W = 1024;
const STAGE_H = 1536;

async function checkAssets() {
  await assertProductsUnchanged();
  console.log("\n[1/3] 🔍 Checking Game Assets...");
  const startTime = Date.now();
  
  // 1. Check Layers
  for (const id of REQUIRED_LAYERS) {
    const filePath = `public/game/studio/layers/${id}.png`;
    try {
      const meta = await sharp(filePath).metadata();
      if (meta.width !== STAGE_W || meta.height !== STAGE_H) {
        throw new Error(`Invalid dimensions ${meta.width}x${meta.height} (expected ${STAGE_W}x${STAGE_H})`);
      }
      if (!meta.hasAlpha) {
        throw new Error(`Missing alpha channel`);
      }
    } catch (err) {
      console.error(`  ❌ Layer error: ${filePath} -> ${err.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✅ All ${REQUIRED_LAYERS.length} stage layers verified (${STAGE_W}x${STAGE_H} with alpha).`);

  // 2. Check Products (Cards)
  for (const id of REQUIRED_PRODUCTS) {
    const filePath = `public/game/studio/products/${id}.png`;
    try {
      const meta = await sharp(filePath).metadata();
      if (!meta.width || !meta.height || !meta.hasAlpha) {
        throw new Error(`Invalid image metadata`);
      }
    } catch (err) {
      console.error(`  ❌ Product error: ${filePath} -> ${err.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✅ All ${REQUIRED_PRODUCTS.length} wardrobe card thumbnails verified.`);

  // 3. Regression: Verify no hip skin leak in model-arms
  const armsRaw = await sharp("public/game/studio/layers/model-arms.png").raw().toBuffer();
  let hipSkinOverlay = 0;
  for (let y = 620; y < 720; y++) {
    for (let x = 387; x <= 670; x++) {
      if (armsRaw[(y * STAGE_W + x) * 4 + 3] > 10) hipSkinOverlay++;
    }
  }
  if (hipSkinOverlay > 0) {
    console.error(`  ❌ Hip skin leak detected: ${hipSkinOverlay} pixels in model-arms!`);
    process.exit(1);
  }
  console.log(`  ✅ Model foreground arms: 0 hip skin leakage.`);

  // 4. Verify ready.json
  const readyRaw = JSON.parse(await fs.readFile("public/game/studio/layers/ready.json", "utf8"));
  const readyIds = new Set(readyRaw.items.map((it) => it.id));
  for (const id of REQUIRED_PRODUCTS) {
    if (!readyIds.has(id)) {
      console.error(`  ❌ ready.json missing item: ${id}`);
      process.exit(1);
    }
  }
  console.log(`  ✅ ready.json metadata in sync with active catalog.`);

  console.log(`  ⚡ Asset check completed in ${Date.now() - startTime}ms.`);
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

function checkTypecheck() {
  console.log("\n[2/3] 📘 Running TypeScript Typecheck...");
  const startTime = Date.now();
  const res = spawnSync(npxCmd, ["tsc", "--noEmit"], {
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`  ❌ Typecheck failed!`);
    process.exit(res.status ?? 1);
  }
  console.log(`  ✅ TypeScript passed in ${Date.now() - startTime}ms.`);
}

function checkE2E(isFull = false) {
  console.log(`\n[3/3] 🎭 Running Playwright E2E Tests (${isFull ? "Full suite" : "Fast core"})...`);
  const startTime = Date.now();
  const testArgs = isFull
    ? ["playwright", "test"]
    : ["playwright", "test", "tests/production-v2.spec.ts", "tests/game.spec.ts"];

  const res = spawnSync(npxCmd, testArgs, {
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`  ❌ Playwright tests failed!`);
    process.exit(res.status ?? 1);
  }
  console.log(`  ✅ Playwright passed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
}

async function main() {
  const isFull = process.argv.includes("--full");
  console.log(`🚀 Starting Studio Check Pipeline (${isFull ? "FULL" : "FAST"})...`);
  const overallStart = Date.now();

  await checkAssets();
  checkTypecheck();
  checkE2E(isFull);

  console.log(`\n🎉 All checks PASSED successfully in ${((Date.now() - overallStart) / 1000).toFixed(1)}s!`);
}

main().catch((err) => {
  console.error("Pipeline fatal error:", err);
  process.exit(1);
});
