import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { FACE_CAPTURE_VERSION } from '../src/lib/face-composite';

const layer = (id: string) => sharp(`public/game/studio/layers/${id}.png`).ensureAlpha().raw().toBuffer();
const saved = (top: string, bottom = 'bottom-sculpted-jeans') => ({
  selected: { tops: top, bottoms: bottom, shoes: 'shoes-party-platform-boots' }, fits: {}, held: {},
});

test('refreshed cutouts have soft alpha and the split model has no checkerboard leakage', async () => {
  for (const id of [
    'model-upper',
    'model-dressed-upper',
    'model-lower',
    'model-lower-boots',
    'model-face-frame-overlay',
    'top-fitted-denim',
    'top-fitted-denim-pose-swap',
    'top-fitted-denim-pose-hands',
    'top-modal-grommet',
    'top-modal-grommet-pose-swap',
    'top-modal-grommet-pose-hands',
    'top-modal-grommet-skin',
    'bottom-sculpted-jeans',
    'bottom-sculpted-jeans-under-yellow',
    'shoes-party-platform-boots',
  ]) {
    const data = await layer(id);
    expect(data.length).toBe(1024 * 1536 * 4);
    let transparent = 0;
    let soft = 0;
    for (let p = 3; p < data.length; p += 4) {
      if (!data[p]) transparent++;
      else if (data[p] < 255) soft++;
    }
    expect(transparent, id).toBeGreaterThan(800000);
    expect(soft, id).toBeGreaterThan(id === 'top-modal-grommet-skin' ? 100 : 500);
  }

  await expect(fs.access('public/game/studio/layers/model.png')).rejects.toThrow();
  await expect(fs.access('public/game/studio/layers/model-boots.png')).rejects.toThrow();

  for (const id of ['model-dressed-upper', 'model-lower', 'model-lower-boots']) {
    const data = await layer(id);
    let visible = 0;
    let grayCheckerPixels = 0;
    for (let p = 0; p < data.length; p += 4) {
      if (!data[p + 3]) continue;
      visible++;
      const maximum = Math.max(data[p], data[p + 1], data[p + 2]);
      const minimum = Math.min(data[p], data[p + 1], data[p + 2]);
      if (maximum - minimum < 10 && maximum > 70 && maximum < 230) grayCheckerPixels++;
    }
    expect(grayCheckerPixels / visible, `${id} must not contain a rasterized checkerboard`).toBeLessThan(0.01);
  }

  const jeans = await layer('bottom-sculpted-jeans');
  const yellow = await layer('top-modal-grommet');
  const skin = await layer('top-modal-grommet-skin');
  const denim = await layer('top-fitted-denim');
  for (const y of [280, 350, 450, 550, 625]) {
    expect(denim[(y * 1024 + 520) * 4 + 3], `center zipper at y=${y}`).toBeGreaterThan(240);
  }
  for (const [x, y, radius] of [[460, 542, 10], [616, 469, 4], [434, 621, 3]]) {
    expect(yellow[(y * 1024 + x) * 4 + 3], `transparent grommet hole at ${x},${y}`).toBeLessThan(10);
    expect(skin[(y * 1024 + x) * 4 + 3], `skin backing at ${x},${y}`).toBeGreaterThan(240);
    expect(yellow[(y * 1024 + x + radius + 2) * 4 + 3], `metal rim retained at ${x},${y}`).toBeGreaterThan(200);
  }
  expect(jeans[(550 * 1024 + 520) * 4 + 3], 'jeans waistband remains covered').toBeGreaterThan(200);

  const faceFrame = await layer('model-face-frame-overlay');
  expect(faceFrame[(60 * 1024 + 512) * 4 + 3], 'cap is retained').toBeGreaterThan(240);
  for (const [x, y] of [[512, 200], [512, 225], [512, 250], [512, 275]]) {
    expect(faceFrame[(y * 1024 + x) * 4 + 3], `face opening stays clear at ${x},${y}`).toBe(0);
  }
});

for (const top of ['top-fitted-denim', 'top-modal-grommet']) {
  test(`${top} uses the refreshed neutral cutout in play, showcase, and export`, async ({ page }) => {
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
      /bottom-sculpted-jeans\.png/,
    );
    await expect(stage.locator('[data-model-layer="model-lower-boots"]')).toBeVisible();
    await expect(stage.locator('[data-model-layer="model-dressed-upper"]')).toBeVisible();
    await expect(page.getByTestId('top-modal-skin-backing')).toHaveCount(top === 'top-modal-grommet' ? 1 : 0);
    await stage.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await page.screenshot({ path: `artifacts/studio/qa/production-v2/${top}-neutral-browser.png` });

    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}-pose\\.png`));
    await expect(stage.locator('img').first()).toHaveAttribute('src', /model-lower-boots/);
    await expect(stage.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveAttribute('src', pants!);
    await stage.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await page.screenshot({ path: `artifacts/studio/qa/production-v2/${top}-showcase-browser.png` });
    await page.getByTestId('showcase-edit-btn').click();
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}\\.png`));
    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
    await page.getByTestId('showcase-save-btn').click();
    await expect(page).toHaveURL(/\/photoshoot/);
    await expect(page.getByTestId('photoshoot-look')).toBeVisible();
    const url = await page.getByTestId('photoshoot-look').getAttribute('src');
    const exported = await sharp(Buffer.from(url!.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer();
    expect(exported[(200 * 1024 + 520) * 4 + 3], 'export retains the upper model').toBeGreaterThan(200);
    expect(failures).toEqual([]);
  });
}

for (const top of ['top-fitted-denim', 'top-modal-grommet'] as const) {
  test(`${top} custom face keeps the showcase pose and stacks frame then pose-specific hands`, async ({ page }) => {
    const facePng = await sharp({
      create: { width: 160, height: 190, channels: 4, background: { r: 220, g: 70, b: 150, alpha: 1 } },
    }).png().toBuffer();
    const look = {
      ...saved(top),
      userFace: `data:image/png;base64,${facePng.toString('base64')}`,
      userFaceVersion: FACE_CAPTURE_VERSION,
      isDenimTucked: false,
    };
    await page.addInitScript(value => {
      localStorage.setItem('tung-tung-play-ge', JSON.stringify(value));
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
      });
    }, look);

    await page.goto('/play');
    await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();

    const stage = page.getByTestId('studio-stage');
    const face = stage.getByTestId('user-face-sprite');
    const garment = stage.locator(`[data-garment="${top}"]`);
    await expect(face).toHaveAttribute('data-face-pose', 'face-safe-neutral');
    await expect(garment).toHaveAttribute('src', new RegExp(`${top}-pose-swap\\.png`));
    await expect(stage.locator('[data-model-layer="model-dressed-upper"]')).toHaveCount(0);
    const frame = stage.getByTestId('user-hair-hat-overlay');
    const hands = stage.getByTestId('foreground-hands');
    await expect(frame).toHaveAttribute('src', /model-face-frame-overlay\.png/);
    await expect(hands).toHaveAttribute('src', new RegExp(`${top}-pose-hands\\.png`));
    const faceZ = await face.evaluate(element => Number(getComputedStyle(element).zIndex));
    const frameZ = await frame.evaluate(element => Number(getComputedStyle(element).zIndex));
    const handsZ = await hands.evaluate(element => Number(getComputedStyle(element).zIndex));
    expect(faceZ).toBeLessThan(frameZ);
    expect(frameZ).toBeLessThan(handsZ);

    await page.getByTestId('open-face-cam-btn').click();
    const viewport = page.locator('.face-cam-viewport');
    await expect(viewport).toHaveAttribute('data-face-pose', 'face-safe-neutral');
    await expect(viewport.locator('.face-cam-overlay')).toHaveCount(0);
    await expect(viewport.getByTestId('face-cam-accessory-overlay')).toHaveAttribute('src', /model-face-frame-overlay\.png/);
    const guide = viewport.locator('.face-cam-features-guide > g');
    await expect(guide).toHaveAttribute('transform', /rotate\(0 /);
    const ellipse = guide.locator('ellipse');
    expect(Number(await ellipse.getAttribute('ry')) / Number(await ellipse.getAttribute('rx'))).toBeGreaterThan(1.25);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'face.png',
      mimeType: 'image/png',
      buffer: facePng,
    });
    const panX = page.getByRole('slider', { name: /Ngang/ });
    const panY = page.getByRole('slider', { name: /Vị trí dọc/ });
    const roll = page.getByRole('slider', { name: /Độ nghiêng/ });
    await expect(panX).toBeVisible();
    await expect(roll).toBeVisible();
    const bounds = await viewport.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width / 2 + 24, bounds!.y + bounds!.height / 2 + 16);
    await page.mouse.up();
    expect(Number(await panX.inputValue())).toBeGreaterThan(0);
    expect(Number(await panY.inputValue())).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Căn lại' }).click();
    await expect(panX).toHaveValue('0');
    await expect(panY).toHaveValue('0');
    await panX.fill('7');
    await panY.fill('-5');
    await roll.fill('2');
    await expect(viewport.locator('img.face-cam-media')).toHaveAttribute('style', /translate\(7px, -5px\) rotate\(2deg\)/);
    await page.screenshot({ path: `artifacts/studio/qa/face-cam/face-safe-${top}-guide.png` });

    await page.getByTestId('face-cam-snap-btn').click();
    const captured = viewport.locator('.face-cam-captured-face');
    await expect(captured).toBeVisible();
    const capturedUrl = await captured.getAttribute('src');
    const capturedPixels = await sharp(Buffer.from(capturedUrl!.split(',')[1], 'base64'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(capturedPixels.info.width).toBe(160);
    expect(capturedPixels.info.height).toBe(190);
    let transparent = 0;
    let opaque = 0;
    let soft = 0;
    for (let p = 3; p < capturedPixels.data.length; p += 4) {
      if (capturedPixels.data[p] === 0) transparent++;
      else if (capturedPixels.data[p] === 255) opaque++;
      else soft++;
    }
    expect(transparent).toBeGreaterThan(1000);
    expect(opaque).toBeGreaterThan(1000);
    expect(soft).toBeGreaterThan(500);
    await page.screenshot({ path: `artifacts/studio/qa/face-cam/face-safe-${top}-captured.png` });
    const tuckedBeforeConfirm = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tung-tung-play-ge') || '{}').isDenimTucked,
    );
    await page.getByTestId('face-cam-confirm-btn').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem('tung-tung-play-ge') || '{}').isDenimTucked,
        ),
      )
      .toBe(tuckedBeforeConfirm);
  });
}

test('selecting a top without bottoms keeps the lower model visible', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tung-tung-play-ge', JSON.stringify({
    selected: { tops: 'top-modal-grommet' }, fits: {}, held: {},
  })));
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
  const stage = page.getByTestId('studio-stage');
  await expect(stage.locator('[data-model-layer="model-lower"]')).toBeVisible();
  await expect(stage.locator('[data-model-layer="model-dressed-upper"]')).toBeVisible();
  await expect(stage.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveCount(0);
  await expect(stage.locator('[data-garment="top-modal-grommet"]')).toBeVisible();
});

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
