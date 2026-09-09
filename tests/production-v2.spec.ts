import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const layer = (id: string) => sharp(`public/game/studio/layers/${id}.png`).ensureAlpha().raw().toBuffer();
const saved = (top: string, bottom = 'bottom-sculpted-jeans') => ({
  selected: { tops: top, bottoms: bottom, shoes: 'shoes-party-platform-boots' }, fits: {}, held: {},
});

test('production assets have soft alpha, clean denim edges, and unchanged pose legs', async () => {
  for (const id of ['model', 'top-fitted-denim', 'top-modal-grommet', 'bottom-sculpted-jeans', 'bottom-sculpted-jeans-under-yellow', 'shoes-party-platform-boots', 'top-fitted-denim-pose', 'top-modal-grommet-pose']) {
    const data = await layer(id);
    expect(data.length).toBe(1024 * 1536 * 4);
    let transparent = 0, soft = 0;
    for (let p = 3; p < data.length; p += 4) { if (!data[p]) transparent++; else if (data[p] < 255) soft++; }
    expect(transparent, id).toBeGreaterThan(800000);
    expect(soft, id).toBeGreaterThan(500);
  }
  const base = await layer('model');
  const lower = await layer('model-lower');
  expect(lower.subarray(900 * 1024 * 4).equals(base.subarray(900 * 1024 * 4))).toBe(true);
  const jeans = await layer('bottom-sculpted-jeans');
  let fringe = 0;
  for (let y = 920; y < 1180; y++) for (let x = 495; x < 570; x++) {
    const p = (y * 1024 + x) * 4;
    if (jeans[p + 3] > 10 && Math.min(jeans[p], jeans[p + 1], jeans[p + 2]) > 180) fringe++;
  }
  expect(fringe).toBe(0);
  const yellow = await layer('top-modal-grommet');
  const yellowSource = await sharp('assets/studio/manual-extraction/production-v2-white/item/02-Modal-Grommet-Top-White-Background.png')
    .resize(1024, 1536, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let opaque = 0, sourceExact = 0;
  for (let p = 0; p < 1024 * 1536; p++) {
    if (yellow[p * 4 + 3] !== 255) continue;
    opaque++;
    if (yellow[p * 4] === yellowSource[p * 3] && yellow[p * 4 + 1] === yellowSource[p * 3 + 1] && yellow[p * 4 + 2] === yellowSource[p * 3 + 2]) sourceExact++;
  }
  expect(sourceExact / opaque, 'opaque shirt pixels must remain faithful to the approved source').toBeGreaterThan(0.985);
  const denim = await layer('top-fitted-denim');
  for (const y of [300, 350, 400, 500, 600]) {
    expect(denim[(y * 1024 + 520) * 4 + 3], `center zipper at y=${y}`).toBeGreaterThan(240);
  }
  for (const [x, y, radius] of [[465, 543, 14], [608, 470, 6], [440, 622, 6]]) {
    expect(yellow[(y * 1024 + x) * 4 + 3], `transparent grommet hole at ${x},${y}`).toBe(0);
    expect(yellow[(y * 1024 + x + radius + 3) * 4 + 3], `metal rim retained at ${x},${y}`).toBeGreaterThan(240);
  }
  const jeansUnderYellow = await layer('bottom-sculpted-jeans-under-yellow');
  const span = (rgba: Buffer, y: number) => {
    let left = 1024, right = -1;
    for (let x = 0; x < 1024; x++) if (rgba[(y * 1024 + x) * 4 + 3] > 32) { left = Math.min(left, x); right = x; }
    return { left, right, width: right - left + 1 };
  };
  for (const y of [620, 640]) {
    const baseSpan = span(jeans, y), fittedSpan = span(jeansUnderYellow, y), shirtSpan = span(yellow, y);
    expect(fittedSpan.width, `narrowed waistband at y=${y}`).toBeLessThan(baseSpan.width);
    expect(fittedSpan.left, `left waistband hidden at y=${y}`).toBeGreaterThanOrEqual(shirtSpan.left);
    expect(fittedSpan.right, `right waistband hidden at y=${y}`).toBeLessThanOrEqual(shirtSpan.right);
  }
  expect(jeansUnderYellow.subarray(700 * 1024 * 4, 701 * 1024 * 4).equals(jeans.subarray(700 * 1024 * 4, 701 * 1024 * 4)), 'pants return to full width below the shirt').toBe(true);

  const arms = await layer('model-arms');
  let hipSkinOverlay = 0;
  for (let y = 620; y < 720; y++) for (let x = 387; x <= 670; x++) {
    if (arms[(y * 1024 + x) * 4 + 3] > 10) hipSkinOverlay++;
  }
  expect(hipSkinOverlay, 'foreground arms must not paint skin over the pants at the hips').toBe(0);
});

for (const top of ['top-fitted-denim', 'top-modal-grommet']) {
  test(`${top} poses only in showcase and exports that pose`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.addInitScript(look => localStorage.setItem('tung-tung-play-ge', JSON.stringify(look)), saved(top));
    await page.goto('/play');
    await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
    const stage = page.getByTestId('studio-stage');
    const garment = stage.locator(`[data-garment="${top}"]`);
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}\\.png`));
    const pants = await stage.locator('[data-garment="bottom-sculpted-jeans"]').getAttribute('src');
    await expect(stage.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveAttribute(
      'src',
      top === 'top-modal-grommet' ? /bottom-sculpted-jeans-under-yellow\.png/ : /bottom-sculpted-jeans\.png/,
    );
    if (top === 'top-fitted-denim') {
      await stage.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
      await page.screenshot({ path: 'artifacts/studio/qa/production-v2/neutral-hip-mask-browser.png' });
    }
    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}-pose\\.png`));
    await expect(stage.locator('img').first()).toHaveAttribute('src', /model-lower-boots/);
    await expect(stage.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveAttribute('src', pants!);
    await expect(page.getByTestId('foreground-arms')).toHaveCount(0);
    await stage.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await page.screenshot({ path: `artifacts/studio/qa/production-v2/${top}-browser.png` });
    await page.getByTestId('showcase-edit-btn').click();
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}\\.png`));
    await expect(page.getByTestId('foreground-arms')).toBeVisible();
    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
    await page.getByTestId('showcase-save-btn').click();
    await expect(page).toHaveURL(/\/photoshoot/);
    await expect(page.getByTestId('photoshoot-look')).toBeVisible();
    const url = await page.getByTestId('photoshoot-look').getAttribute('src');
    const exported = await sharp(Buffer.from(url!.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer();
    // Raised elbow exists outside the neutral silhouette in the exported PNG.
    expect(exported[((top === 'top-fitted-denim' ? 240 : 275) * 1024 + 200) * 4 + 3]).toBeGreaterThan(200);
    expect(failures).toEqual([]);
  });
}

test('withheld skirt and removed Mary Janes are absent from the wardrobe', async ({ page }) => {
  await page.addInitScript(look => localStorage.setItem('tung-tung-play-ge', JSON.stringify(look)), saved('top-fitted-denim', 'bottom-denim-sculpted-skirt'));
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tung-tung-play-ge') || '{}').selected?.bottoms || null)).toBeNull();
  await expect(page.getByRole('button', { name: 'SHOW YOUR LOOK' })).toBeDisabled();
  if (await page.getByTestId('category-launcher').getAttribute('aria-expanded') !== 'true') await page.getByTestId('category-launcher').click();
  await page.getByTestId('category-bottoms').click();
  await expect(page.getByTestId('garment-bottom-sculpted-jeans')).toBeVisible();
  await expect(page.getByTestId('garment-bottom-denim-sculpted-skirt')).toHaveCount(0);
  await expect(page.locator('[data-garment="bottom-denim-sculpted-skirt"]')).toHaveCount(0);
  await page.getByTestId('category-shoes').click();
  await expect(page.getByTestId('garment-shoes-party-platform-boots')).toBeVisible();
  await expect(page.getByTestId('garment-shoes-mary-janes')).toHaveCount(0);
});
