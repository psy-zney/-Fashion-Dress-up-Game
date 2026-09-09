import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { audit, build } from './layer-pipeline.mjs';
import { assertProductsUnchanged, projectRoot, sha256 } from './product-lock.mjs';

async function fixture() {
  const parent = path.join(projectRoot, 'artifacts/studio/pipeline-tests');
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'case-'));
  for (const directory of ['scripts/studio', 'public/game/studio/products', 'public/game/studio/layers', 'assets/studio/test']) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }
  const product = Buffer.from('separately supplied product; must remain byte-identical');
  await fs.writeFile(path.join(root, 'public/game/studio/products/top.png'), product);
  await fs.writeFile(path.join(root, 'scripts/studio/product-lock.json'), JSON.stringify({ files: { 'top.png': sha256(product) } }));
  await fs.writeFile(path.join(root, 'public/game/studio/layers/ready.json'), JSON.stringify({ version: 'unchanged-runtime' }));
  await fs.writeFile(path.join(root, 'public/game/studio/layers/top-modal-grommet.png'), 'unchanged runtime layer');
  const source = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: '#cf2731' } }).png().toBuffer();
  const maskRaw = Buffer.alloc(1024 * 1536 * 4);
  for (let y = 300; y < 650; y++) for (let x = 400; x < 640; x++) {
    const p = (y * 1024 + x) * 4;
    maskRaw[p] = maskRaw[p + 1] = maskRaw[p + 2] = 255;
    maskRaw[p + 3] = x === 400 || x === 639 || y === 300 || y === 649 ? 128 : 255;
  }
  const mask = await sharp(maskRaw, { raw: { width: 1024, height: 1536, channels: 4 } }).png().toBuffer();
  await fs.writeFile(path.join(root, 'assets/studio/test/source.png'), source);
  await fs.writeFile(path.join(root, 'assets/studio/test/mask.png'), mask);
  const manifest = { schema: 1, release: 'fixture-draft', layers: [{ id: 'top-modal-grommet', status: 'source-reviewed',
    source: { path: 'assets/studio/test/source.png', sha256: sha256(source) },
    mask: { path: 'assets/studio/test/mask.png', sha256: sha256(mask) } }] };
  return { root, manifest };
}

test('repository product lock and audit do not imply a visual pass', async () => {
  assert.equal(await assertProductsUnchanged(), 4);
  const report = await audit();
  assert.equal(report.mode, 'read-only');
  assert.match(report.note, /does not approve visual quality/);
});

test('build preserves red source RGB and writes only a unique draft, leaving runtime/product unchanged', async () => {
  const { root, manifest } = await fixture();
  const report = await build(manifest, root);
  assert.equal(report.status, 'draft-needs-composite-and-zoom-review');
  assert.equal(await assertProductsUnchanged(root), 1);
  assert.equal(await fs.readFile(path.join(root, 'public/game/studio/layers/top-modal-grommet.png'), 'utf8'), 'unchanged runtime layer');
  assert.equal((await audit(root)).runtimeVersion, 'unchanged-runtime');
  const data = await sharp(path.join(report.destination, 'layers/top-modal-grommet.png')).raw().toBuffer();
  assert.deepEqual([...data.subarray((400 * 1024 + 500) * 4, (400 * 1024 + 500) * 4 + 4)], [207, 39, 49, 255]);
  assert.equal(data[(400 * 1024 + 400) * 4 + 3], 128);
  assert.equal(data[3], 0);
  await assert.rejects(build(manifest, root), /EEXIST/);
});

test('product tampering stops build before producing candidates', async () => {
  const { root, manifest } = await fixture();
  await fs.writeFile(path.join(root, 'public/game/studio/products/top.png'), 'accidental sprite replacement');
  await assert.rejects(build(manifest, root), /Product lock/);
  await assert.rejects(fs.access(path.join(root, 'artifacts/studio/candidates')));
});

test('unreviewed sources and source/mask hash mismatches cannot enter a build', async () => {
  const { root, manifest } = await fixture();
  manifest.layers[0].status = 'pending-source-review';
  await assert.rejects(build(manifest, root), /has not passed review/);
  manifest.layers[0].status = 'source-reviewed';
  manifest.layers[0].mask.sha256 = '0'.repeat(64);
  await assert.rejects(build(manifest, root), /hash mismatch/);
  await assert.rejects(fs.access(path.join(root, 'artifacts/studio/candidates')));
});

test('product inputs, path traversal and duplicate layer IDs are rejected', async () => {
  const { root, manifest } = await fixture();
  const originalPath = manifest.layers[0].source.path;
  manifest.layers[0].source.path = 'public/game/studio/products/top.png';
  await assert.rejects(build(manifest, root), /not source inputs/);
  manifest.layers[0].source.path = originalPath;
  manifest.release = '../runtime';
  await assert.rejects(build(manifest, root), /Invalid layer manifest/);
  manifest.release = 'fixture-draft';
  manifest.layers.push(structuredClone(manifest.layers[0]));
  await assert.rejects(build(manifest, root), /duplicate layer/);
});

test('wrong-size source is rejected rather than resized into the model coordinate system', async () => {
  const { root, manifest } = await fixture();
  const source = await sharp({ create: { width: 512, height: 768, channels: 3, background: 'red' } }).png().toBuffer();
  await fs.writeFile(path.join(root, manifest.layers[0].source.path), source);
  manifest.layers[0].source.sha256 = sha256(source);
  await assert.rejects(build(manifest, root), /automatic resize\/trim is forbidden/);
});
