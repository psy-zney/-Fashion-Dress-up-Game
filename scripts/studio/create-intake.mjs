import fs from "node:fs/promises";
import path from "node:path";
import { STAGE } from "./pipeline.config.mjs";

const [input, destination] = process.argv.slice(2);
if (!input || !destination) throw new Error("Usage: node scripts/studio/create-intake.mjs <intake.json> <new-output-directory>");
const intake = JSON.parse(await fs.readFile(input, "utf8"));
for (const key of ["id", "revision", "category", "modelReference", "garmentReference", "description"]) {
  if (typeof intake[key] !== "string" || !intake[key].trim()) throw new Error(`Missing intake field: ${key}`);
}
for (const key of ["requiredDetails", "avoid"]) {
  if (!Array.isArray(intake[key]) || !intake[key].every((value) => typeof value === "string")) throw new Error(`${key} must be an array of text`);
}
await Promise.all([fs.access(intake.modelReference), fs.access(intake.garmentReference)]);
const output = path.resolve(destination);
const workspace = path.resolve(".");
if (!output.startsWith(workspace + path.sep) || output.startsWith(path.join(workspace, "public") + path.sep)) {
  throw new Error("Use a new directory inside the project, outside public.");
}
await fs.mkdir(output, { recursive: true });
const prompt = `# ${intake.id} / ${intake.revision}

Attach both images before running this prompt:
1. MODEL / edit target: ${intake.modelReference}
2. GARMENT / product reference: ${intake.garmentReference}

Use case: identity-preserve, front-facing dress-up sprite source.
Canvas: ${STAGE.width} x ${STAGE.height}, portrait. Keep the exact full master canvas, origin, camera distance and framing.
Change only the ${intake.category} garment: ${intake.description}
Preserve the master identity, face, skin, lighting, anatomy, pose, arm and leg positions, hands, feet and silhouette wherever uncovered. The character stands straight, facing forward, arms relaxed. Do not recenter, crop or stretch the body.
Render physically plausible fabric thickness, seams, weave and gravity-driven folds, with realistic material detail consistent with the master's existing illustration style. Preserve the garment design and colors in image 2. Keep all garment edges complete.
Required details:
${intake.requiredDetails.map((value) => `- ${value}`).join("\n")}
Avoid:
${intake.avoid.map((value) => `- ${value}`).join("\n")}
Output one full-canvas image of the same model wearing this item. Do not include a contact sheet, text, icons, drop shadow or extra garments. Preserve the master background for pixel-aligned extraction. Do not invent transparent holes inside opaque fabric.

## Review before integration

Compare identity, shoulder/hand/hip/knee/foot coordinates against the master at 100%. Reject pose or camera drift. Then inspect the actual garment, neckline, both cuffs, waistband, full hem and footwear edges. Save a versioned source; never replace a current runtime asset directly from generation.
`;
// Exclusive writes keep earlier intake/prompt records recoverable.
await fs.writeFile(path.join(output, "prompt.md"), prompt, { flag: "wx" });
await fs.writeFile(path.join(output, "intake.json"), JSON.stringify(intake, null, 2) + "\n", { flag: "wx" });
console.log(`Prepared prompt and intake: ${output}. No images generated; web assets unchanged.`);
