import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const CORE_MODEL_LAYERS = [
  "model-neutral",
  "model-neutral-shoes",
  "model-neutral-no-arms",
  "model-neutral-no-arms-shoes",
];

async function checkCoreAssets() {
  for (const id of CORE_MODEL_LAYERS) {
    await fs.access(`public/game/studio/layers/model/${id}.png`);
  }
  JSON.parse(await fs.readFile("public/game/studio/layers/ready.json", "utf8"));
}

function checkTypeScript() {
  const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await checkCoreAssets();
checkTypeScript();
console.log("Runtime assets and TypeScript are valid.");
