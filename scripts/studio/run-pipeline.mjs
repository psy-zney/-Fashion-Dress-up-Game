import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ["prepare", "prepare-assets.mjs"],
  ["validate", "validate-assets.mjs"],
  ["render QA", "render-qa.mjs"],
];

for (const [label, script] of steps) {
  console.log(`\n=== Studio pipeline: ${label} ===`);
  const result = spawnSync(process.execPath, [path.join(directory, script)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`Pipeline stopped at ${label}. Fix the reported issue, then run the pipeline again.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nStudio asset pipeline completed successfully.");
