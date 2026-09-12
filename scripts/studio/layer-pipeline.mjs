import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { assertProductsUnchanged, projectRoot, sha256 } from './product-lock.mjs';

const width = 1024, height = 1536;
const allowed = new Set([
  'model', 'model-boots', 'model-arms', 'model-upper', 'model-dressed-upper', 'model-lower', 'model-lower-boots',
  'model-dressed', 'model-dressed-boots',
  'top-fitted-denim', 'top-fitted-denim-pose', 'top-modal-grommet', 'top-modal-grommet-pose',
  'top-modal-grommet-skin', 'top-modal-grommet-pose-skin',
  'bottom-sculpted-jeans', 'bottom-sculpted-jeans-under-yellow',
]);

async function inputFile(root, relative) {
  if (typeof relative !== 'string' || !relative.startsWith('assets/studio/')) throw new Error('Layer inputs must be archived under assets/studio/; product/runtime files are not source inputs.');
  const archive = await fs.realpath(path.join(root, 'assets/studio'));
  const resolved = await fs.realpath(path.resolve(root, relative));
  const inside = path.relative(archive, resolved);
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error('Input escapes the studio archive.');
  return resolved;
}

async function checkedInput(root, entry, label) {
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error(`${label}: source-bound SHA-256 is required.`);
  const data = await fs.readFile(await inputFile(root, entry.path));
  if (sha256(data) !== entry.sha256) throw new Error(`${label}: hash mismatch; review the source and its mask together.`);
  const meta = await sharp(data).metadata();
  if (meta.width !== width || meta.height !== height) throw new Error(`${label}: expected ${width}x${height}; automatic resize/trim is forbidden.`);
  return data;
}

export async function audit(root = projectRoot) {
  const products = await assertProductsUnchanged(root);
  const ready = JSON.parse(await fs.readFile(path.join(root, 'public/game/studio/layers/ready.json'), 'utf8'));
  return { productsLocked: products, runtimeVersion: ready.version, mode: 'read-only',
    note: 'Structural/product audit only. This does not approve visual quality or install regenerated images.' };
}

export async function build(manifest, root = projectRoot) {
  await assertProductsUnchanged(root);
  if (manifest.schema !== 1 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(manifest.release || '')) throw new Error('Invalid layer manifest/release.');
  if (!Array.isArray(manifest.layers) || !manifest.layers.length) throw new Error('No reviewed layer inputs supplied.');
  const ids = new Set(), prepared = [];
  // Validate and render all inputs first; build never installs into public/.
  for (const layer of manifest.layers) {
    if (!allowed.has(layer.id) || ids.has(layer.id)) throw new Error(`Unknown/duplicate layer: ${layer.id}`);
    ids.add(layer.id);
    if (layer.status !== 'source-reviewed') throw new Error(`${layer.id}: source design/geometry has not passed review.`);
    const source = await checkedInput(root, layer.source, `${layer.id} source`);
    const rgba = await sharp(source).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    if (layer.mask) {
      const maskFile = await checkedInput(root, layer.mask, `${layer.id} mask`);
      if (!(await sharp(maskFile).metadata()).hasAlpha) throw new Error(`${layer.id}: mask must encode coverage in alpha (transparent exterior).`);
      const mask = await sharp(maskFile).ensureAlpha().extractChannel('alpha').raw().toBuffer();
      // Change coverage only. Never classify red stitches, fabric or metal by color.
      for (let p = 0; p < width * height; p++) rgba[p * 4 + 3] = Math.round(rgba[p * 4 + 3] * mask[p] / 255);
    } else if (!(await sharp(source).metadata()).hasAlpha) {
      throw new Error(`${layer.id}: opaque source requires its own reviewed alpha mask.`);
    }
    let opaque = 0, transparent = 0, soft = 0;
    for (let p = 3; p < rgba.length; p += 4) {
      if (rgba[p] === 0) transparent++;
      else if (rgba[p] === 255) opaque++;
      else soft++;
    }
    if (!opaque || !transparent || !soft) throw new Error(`${layer.id}: expected opaque interior, transparent exterior and antialiased edges.`);
    const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    prepared.push({ id: layer.id, png, sha256: sha256(png), opaque, transparent, soft });
  }
  await assertProductsUnchanged(root);
  const candidates = path.join(root, 'artifacts/studio/candidates');
  await fs.mkdir(candidates, { recursive: true });
  // Unique release directory: do not overwrite earlier drafts.
  const destination = path.join(candidates, manifest.release);
  await fs.mkdir(destination);
  await fs.mkdir(path.join(destination, 'layers'));
  await fs.mkdir(path.join(destination, 'qa'));
  for (const item of prepared) {
    await fs.writeFile(path.join(destination, 'layers', `${item.id}.png`), item.png);
    for (const [name, background] of [['dark', '#24212e'], ['white', '#ffffff'], ['mint', '#8ddbc8']]) {
      await sharp(item.png).flatten({ background }).png().toFile(path.join(destination, 'qa', `${item.id}-${name}.png`));
    }
  }
  const report = { schema: 1, release: manifest.release, status: 'draft-needs-composite-and-zoom-review',
    manifestSha256: sha256(JSON.stringify(manifest)), layers: prepared.map(({ png, ...item }) => item),
    missingGates: ['skin-through-eyelets', 'no-base-bodysuit', 'shirt-jeans-seam', 'red-stitches',
      'mobile-400-percent', 'neutral-and-showcase-export', 'cache-and-fit-migration'] };
  await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(destination, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await assertProductsUnchanged(root);
  return { destination, ...report };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 0 || (args.length === 1 && args[0] === 'audit')) {
    console.log(JSON.stringify(await audit(), null, 2));
  } else if (args.length === 2 && args[0] === 'build') {
    console.log(JSON.stringify(await build(JSON.parse(await fs.readFile(path.resolve(projectRoot, args[1]), 'utf8'))), null, 2));
  } else throw new Error('Usage: node scripts/studio/layer-pipeline.mjs audit | build <manifest.json>. No runtime/product publishing is performed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
