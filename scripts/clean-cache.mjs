import fs from "node:fs";

const DIRS_TO_CLEAN = [
  ".next/cache",
  "test-results",
  ".studio-work",
  "artifacts/debug",
  "artifacts/studio/pipeline-tests",
  "out",
];

console.log("🧹 Cleaning caches and temporary artifacts...");
for (const dir of DIRS_TO_CLEAN) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  🗑️  Removed: ${dir}`);
  }
}
console.log("✨ Cache clean completed!");
