import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export async function assertProductsUnchanged(root = projectRoot) {
  const lock = JSON.parse(await fs.readFile(path.join(root, 'scripts/studio/product-lock.json'), 'utf8'));
  const directory = path.join(root, 'public/game/studio/products');
  const actual = (await fs.readdir(directory)).filter(name => name.endsWith('.png')).sort();
  const expected = Object.keys(lock.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Product lock: wardrobe files were added/removed. Never synthesize replacements from layers.');
  for (const name of expected) {
    if (sha256(await fs.readFile(path.join(directory, name))) !== lock.files[name]) throw new Error(`Product lock: ${name} differs from the preserved wardrobe image.`);
  }
  return expected.length;
}

async function main() {
  const productsLocked = await assertProductsUnchanged();
  const ready = JSON.parse(
    await fs.readFile(path.join(projectRoot, 'public/game/studio/layers/ready.json'), 'utf8'),
  );
  console.log(JSON.stringify({
    productsLocked,
    runtimeVersion: ready.version,
    mode: 'read-only',
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
