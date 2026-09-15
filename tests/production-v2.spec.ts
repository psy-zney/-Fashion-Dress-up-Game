import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { FACE_CAPTURE_VERSION } from '../src/lib/face-composite';
import { allGarments, getGarmentLayerOrder, getLayerSubfolder, POSE_TOPS } from '../src/lib/studio';

const layer = (id: string) => sharp(`public/game/studio/layers/${getLayerSubfolder(id)}/${id}.png`).ensureAlpha().raw().toBuffer();
const saved = (top: string, bottom = 'bottom-sculpted-jeans') => ({
  selected: { tops: top, bottoms: bottom, shoes: 'shoes-party-platform-boots' }, fits: {}, held: {},
});

test('denim legwear covers all high-shaft shoes and stays below bottoms', () => {
  const selected = {
    bottoms: 'bottom-sculpted-jeans',
    accessories: ['legwear-pocket-denim-warmers'],
  };
  const byId = (id: string) => allGarments.find((item) => item.id === id)!;

  expect(getGarmentLayerOrder(byId('legwear-pocket-denim-warmers'), selected)).toBe(25);
  for (const shoeId of [
    'shoes-party-platform-boots',
    'shoes-pink-aqua-striped-platform-high-tops',
    'shoes-aqua-coral-wedge-high-tops',
  ]) {
    expect(getGarmentLayerOrder(byId(shoeId), { ...selected, shoes: shoeId })).toBe(24);
  }
  expect(getGarmentLayerOrder(byId('bottom-sculpted-jeans'), selected)).toBe(30);
});

test('full models have soft alpha, preserve ankles, and obsolete model layers are absent', async () => {
  for (const id of [
    'model-neutral',
    'model-neutral-shoes',
    'model-neutral-no-arms',
    'model-neutral-no-arms-shoes',
    'model-face-frame-overlay',
    'top-fitted-denim',
    'top-modal-grommet',
    'top-fitted-denim-pose',
    'top-modal-grommet-pose',
    'top-oversized-mint-zip-tank-pose',
    'top-asymmetric-gradient-denim-shirt-pose',
    'bottom-sculpted-jeans',
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
    expect(soft, id).toBeGreaterThan(500);
  }

  await expect(fs.access('public/game/studio/layers/model.png')).rejects.toThrow();
  await expect(fs.access('public/game/studio/layers/model-boots.png')).rejects.toThrow();
  for (const id of ['model-upper', 'model-dressed-upper', 'model-lower', 'model-lower-boots', 'model-showcase-dressed', 'model-showcase-dressed-shoes', 'model-showcase-hands', 'model-showcase', 'model-showcase-shoes']) {
    await expect(fs.access(`public/game/studio/layers/model/${id}.png`)).rejects.toThrow();
  }

  for (const id of ['model-neutral', 'model-neutral-shoes', 'model-neutral-no-arms', 'model-neutral-no-arms-shoes']) {
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

for (const top of ['top-fitted-denim', 'top-modal-grommet', 'top-asymmetric-gradient-denim-shirt'] as const) {
  test(`${top} uses the refreshed neutral cutout in play, showcase, and export`, async ({ page }) => {
    test.slow();
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
    await expect(stage.locator('[data-model-layer="model-neutral-shoes"]')).toBeVisible();
    await expect(page.getByTestId('top-modal-skin-backing')).toHaveCount(top === 'top-modal-grommet' ? 1 : 0);
    await stage.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await page.screenshot({ path: `artifacts/studio/qa/production-v2/${top}-neutral-browser.png` });

    const showcaseAsset = POSE_TOPS[top] || top;
    await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
    await expect(garment).toHaveAttribute('src', new RegExp(showcaseAsset + '\.png'));
    await expect(stage.locator('[data-model-layer="model-neutral-no-arms-shoes"]')).toBeVisible();
    await expect(stage.getByTestId('foreground-hands')).toHaveCount(0);
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
  test(`${top} custom face restores the hands-on-hips swap pose`, async ({ page }) => {
    test.slow();
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
    await expect(face).toHaveCount(0);
    await page.getByTestId('toggle-face-composite-btn').click();
    await expect(face).toHaveAttribute('data-face-pose', 'face-safe-neutral');
    await expect(garment).toHaveAttribute('src', new RegExp(top + '-pose-swap\\.png'));
    await expect(stage.locator('[data-model-layer="model-neutral-no-arms-shoes"]')).toBeVisible();
    await expect(stage.locator('[data-model-layer="model-neutral-shoes"]')).toHaveCount(0);
    const frame = stage.getByTestId('user-hair-hat-overlay');
    await expect(frame).toBeVisible();
    await expect(stage.getByTestId('foreground-hands')).toHaveCount(0);

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
    const panX = page.getByRole('slider', { name: /Horizontal|Ngang/i });
    const panY = page.getByRole('slider', { name: /Vertical|Vị trí dọc/i });
    const roll = page.getByRole('slider', { name: /Rotate|Độ nghiêng/i });
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
    await page.getByRole('button', { name: /Reset|Căn lại/i }).click();
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

test('Add Face keeps the hands-on-hips swap pose for regular tops before capture', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tung-tung-play-ge', JSON.stringify({
      selected: {
        tops: 'top-fitted-denim',
        bottoms: 'bottom-sculpted-jeans',
        shoes: 'shoes-party-platform-boots',
        accessories: ['legwear-pocket-denim-warmers', 'accessory-abstract-denim-hip-scarf'],
      },
      fits: {},
      held: {},
    }));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    });
  });
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
  await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();
  const stage = page.getByTestId('studio-stage');
  await expect(stage.locator('[src*="top-fitted-denim-pose.png"]')).toBeVisible();

  await page.getByTestId('open-face-cam-btn').click();
  await expect(page.getByRole('dialog', { name: 'Face Capture — Show Your Look' })).toBeVisible();
  await expect(stage.locator('[data-model-layer="model-neutral-no-arms-shoes"]')).toBeVisible();
  await expect(stage.locator('[data-model-layer="model-neutral-shoes"]')).toHaveCount(0);
  await expect(stage.locator('[data-garment="top-fitted-denim"]')).toHaveAttribute('src', /top-fitted-denim-pose-swap\.png/);
  const legwear = stage.locator('[data-garment="legwear-pocket-denim-warmers"]');
  const highBoots = stage.locator('[data-garment="shoes-party-platform-boots"]');
  expect(await legwear.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(25);
  expect(await highBoots.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(24);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(stage.locator('[data-garment="top-fitted-denim"]')).toHaveAttribute('src', /top-fitted-denim-pose-swap\.png/);
});

test('selecting a top without bottoms keeps the lower model visible', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tung-tung-play-ge', JSON.stringify({
    selected: { tops: 'top-modal-grommet' }, fits: {}, held: {},
  })));
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
  const stage = page.getByTestId('studio-stage');
  await expect(stage.locator('[data-model-layer="model-neutral"]')).toBeVisible();
  const showButton = page.getByRole('button', { name: 'SHOW YOUR LOOK' });
  await expect(showButton).toBeEnabled();
  await showButton.click();
  await expect(stage.locator('[data-model-layer="model-neutral-no-arms"]')).toBeVisible();
  await expect(stage.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveCount(0);
  await expect(stage.locator('[data-garment="top-modal-grommet"]')).toBeVisible();
});

test('withheld skirt and removed Mary Janes are absent from the wardrobe', async ({ page }) => {
  test.slow();
  await page.addInitScript(look => localStorage.setItem('tung-tung-play-ge', JSON.stringify(look)), saved('top-fitted-denim', 'bottom-denim-sculpted-skirt'));
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tung-tung-play-ge') || '{}').selected?.bottoms || null)).toBeNull();
  await expect(page.getByRole('button', { name: 'SHOW YOUR LOOK' })).toBeEnabled();
  if (await page.getByTestId('category-launcher').getAttribute('aria-expanded') !== 'true') await page.getByTestId('category-launcher').click();
  await page.getByTestId('category-bottoms').click();
  await expect(page.getByTestId('garment-bottom-sculpted-jeans')).toBeVisible();
  await expect(page.getByTestId('garment-bottom-denim-sculpted-skirt')).toHaveCount(0);
  await expect(page.locator('[data-garment="bottom-denim-sculpted-skirt"]')).toHaveCount(0);
  await page.getByTestId('category-shoes').click();
  await expect(page.getByTestId('garment-shoes-party-platform-boots')).toBeVisible();
  await expect(page.getByTestId('garment-shoes-mary-janes')).toHaveCount(0);
});

test('clicking an equipped garment a 2nd time unequips it, and accessories category has warmers and scarf', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });

  // 1. Verify old extra categories box is gone
  await expect(page.locator('.wardrobe-extra-categories')).toHaveCount(0);

  // 2. Verify all 4 wheel categories exist
  await expect(page.getByTestId('category-tops')).toBeVisible();
  await expect(page.getByTestId('category-bottoms')).toBeVisible();
  await expect(page.getByTestId('category-shoes')).toBeVisible();
  await expect(page.getByTestId('category-accessories')).toBeVisible();

  // 3. Click Tops -> Wear Fitted Denim Top (1st click)
  await page.getByTestId('category-tops').click();
  const denimTopCard = page.getByTestId('garment-top-fitted-denim');
  await denimTopCard.click();
  await expect(page.locator('[data-garment="top-fitted-denim"]')).toBeVisible();
  await expect(denimTopCard).toHaveClass(/is-selected/);

  // 4. Click Fitted Denim Top again (2nd click) -> unequips!
  await denimTopCard.click();
  await expect(page.locator('[data-garment="top-fitted-denim"]')).toHaveCount(0);
  await expect(denimTopCard).not.toHaveClass(/is-selected/);

  // 5. Navigate to Accessories on wheel
  await page.getByTestId('category-accessories').click();
  const scarfCard = page.getByTestId('garment-accessory-abstract-denim-hip-scarf');
  const warmersCard = page.getByTestId('garment-legwear-pocket-denim-warmers');
  await expect(scarfCard).toBeVisible();
  await expect(warmersCard).toBeVisible();

  // 6. Wear both accessories simultaneously
  await scarfCard.click();
  await expect(page.locator('[data-garment="accessory-abstract-denim-hip-scarf"]')).toBeVisible();
  await expect(scarfCard).toHaveClass(/is-selected/);

  await warmersCard.click();
  await expect(page.locator('[data-garment="legwear-pocket-denim-warmers"]')).toBeVisible();
  await expect(warmersCard).toHaveClass(/is-selected/);
  // Both accessories are visible on stage simultaneously
  await expect(page.locator('[data-garment="accessory-abstract-denim-hip-scarf"]')).toBeVisible();

  // 7. Unwear scarf, warmers remain
  await scarfCard.click();
  await expect(page.locator('[data-garment="accessory-abstract-denim-hip-scarf"]')).toHaveCount(0);
  await expect(scarfCard).not.toHaveClass(/is-selected/);
  await expect(page.locator('[data-garment="legwear-pocket-denim-warmers"]')).toBeVisible();
  await expect(warmersCard).toHaveClass(/is-selected/);

  // 8. Unwear warmers
  await warmersCard.click();
  await expect(page.locator('[data-garment="legwear-pocket-denim-warmers"]')).toHaveCount(0);
  await expect(warmersCard).not.toHaveClass(/is-selected/);
});

test('strapless denim dress is in tops category, wearing it clears and blocks bottoms, and pairs with shoes for photoshoot', async ({ page }) => {
  test.slow();
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 20000 });

  // 1. Wear sculpted jeans from bottoms
  await page.getByTestId('category-bottoms').click();
  const jeansCard = page.getByTestId('garment-bottom-sculpted-jeans');
  await jeansCard.click();
  await expect(page.locator('[data-garment="bottom-sculpted-jeans"]')).toBeVisible();

  // 2. Go to Tops -> verify dress is present in Tops category
  await page.getByTestId('category-tops').click();
  const dressCard = page.getByTestId('garment-dress-strapless-deep-fold-denim');
  await expect(dressCard).toBeVisible();

  // 3. Click dress -> equips dress, and automatically removes jeans
  await dressCard.click();
  await expect(page.locator('[data-garment="dress-strapless-deep-fold-denim"]')).toBeVisible();
  await expect(page.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveCount(0);

  // 4. Go to Bottoms -> verify bottoms are blocked
  await page.getByTestId('category-bottoms').click();
  await expect(page.getByTestId('wardrobe-bottoms-blocked')).toBeVisible();
  await expect(jeansCard).toHaveClass(/is-blocked/);

  // 5. Clicking jeans while wearing dress does NOT equip jeans
  await jeansCard.click({ force: true });
  await expect(page.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveCount(0);

  // 6. Equip shoes -> dress + shoes completes outfit
  await page.getByTestId('category-shoes').click();
  await page.getByTestId('garment-shoes-party-platform-boots').click();
  await page.getByTestId('category-accessories').click();
  await page.getByTestId('garment-legwear-pocket-denim-warmers').click();
  await expect(page.getByRole('button', { name: 'SHOW YOUR LOOK' })).toBeEnabled();

  // 7. Go back to tops and click dress 2nd time -> unequips dress, unblocking bottoms
  await page.getByTestId('category-tops').click();
  await dressCard.click();
  await expect(page.locator('[data-garment="dress-strapless-deep-fold-denim"]')).toHaveCount(0);

  // 8. Go to Bottoms -> verify bottoms are now unblocked and can be worn
  await page.getByTestId('category-bottoms').click();
  await expect(page.getByTestId('wardrobe-bottoms-blocked')).toHaveCount(0);
  await expect(jeansCard).not.toHaveClass(/is-blocked/);
  await jeansCard.click();
  await expect(page.locator('[data-garment="bottom-sculpted-jeans"]')).toBeVisible();
});

test('strapless denim dress showcase uses special pose image without model and only overlays shoes/accessories', async ({ page }) => {
  test.slow();
  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 35000 });

  // 1. Equip dress and shoes
  await page.getByTestId('category-tops').click();
  await page.getByTestId('garment-dress-strapless-deep-fold-denim').click();
  await page.getByTestId('category-shoes').click();
  await page.getByTestId('garment-shoes-party-platform-boots').click();

  // In normal wardrobe mode: regular model + dress cutout + shoes
  await expect(page.locator('[data-model-layer="model-neutral-shoes"]')).toBeVisible();
  await expect(page.locator('[data-garment="dress-strapless-deep-fold-denim"]')).toBeVisible();
  await expect(page.locator('[data-garment="shoes-party-platform-boots"]')).toBeVisible();

  // 2. Click SHOW YOUR LOOK -> Special Showcase mode
  await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();

  // Model replaced by dress pose image directly
  await expect(page.locator('[data-model-layer="dress-strapless-deep-fold-denim-pose"]')).toBeVisible();
  await expect(page.locator('[data-model-layer="model-neutral-no-arms-shoes"]')).toHaveCount(0);
  await expect(page.locator('[data-model-layer="model-neutral-shoes"]')).toHaveCount(0);

  // Dress itself is NOT rendered as an extra garment layer on top
  await expect(page.locator('[data-garment="dress-strapless-deep-fold-denim"]')).toHaveCount(0);
  // Bottoms not rendered
  await expect(page.locator('[data-garment="bottom-sculpted-jeans"]')).toHaveCount(0);
  // Shoes rendered on top
  await expect(page.locator('[data-garment="shoes-party-platform-boots"]')).toBeVisible();

  // Face swap is available; activating it switches to the standing-model branch.
  const addFace = page.getByTestId('open-face-cam-btn');
  await expect(addFace).toBeVisible();
  await addFace.click();
  await expect(page.getByRole('dialog', { name: 'Face Capture — Show Your Look' })).toBeVisible();
  await expect(page.locator('[data-model-layer="model-neutral-shoes"]')).toBeVisible();
  await expect(page.locator('[data-model-layer="dress-strapless-deep-fold-denim-pose"]')).toHaveCount(0);
  await expect(page.getByTestId('foreground-jeans-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('foreground-jeans-overlay')).toHaveCount(0);

  // 3. Save look and go to photoshoot
  await page.getByTestId('showcase-save-btn').click();
  await expect(page).toHaveURL(/\/photoshoot/);
  await expect(page.getByTestId('photoshoot-look')).toBeVisible();
});

test('special dress isolates the legwear sandwich from the standing face-swap branch', async ({ page }) => {
  test.slow();
  const facePng = await sharp({
    create: { width: 160, height: 190, channels: 4, background: { r: 220, g: 70, b: 150, alpha: 1 } },
  }).png().toBuffer();
  await page.addInitScript((look) => {
    localStorage.setItem('tung-tung-play-ge', JSON.stringify(look));
  }, {
    selected: {
      tops: 'dress-strapless-deep-fold-denim',
      shoes: 'shoes-party-platform-boots',
      accessories: ['legwear-pocket-denim-warmers'],
    },
    fits: {},
    held: {},
    userFace: `data:image/png;base64,${facePng.toString('base64')}`,
    userFaceVersion: FACE_CAPTURE_VERSION,
    isFaceCompositeMode: false,
  });

  await page.goto('/play');
  await expect(page.getByTestId('heart-loader')).toHaveCount(0, { timeout: 35000 });
  await page.getByRole('button', { name: 'SHOW YOUR LOOK' }).click();

  const stage = page.getByTestId('studio-stage');
  const pose = stage.locator('[data-model-layer="dress-strapless-deep-fold-denim-pose"]');
  const legwear = stage.locator('[data-garment="legwear-pocket-denim-warmers"]');
  const highBoots = stage.locator('[data-garment="shoes-party-platform-boots"]');
  const cover = stage.getByTestId('foreground-jeans-overlay');
  await expect(pose).toBeVisible();
  await expect(legwear).toBeVisible();
  await expect(cover).toBeVisible();
  expect(await pose.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(0);
  expect(await highBoots.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(1);
  expect(await legwear.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(2);
  expect(await cover.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(3);

  await page.getByTestId('toggle-face-composite-btn').click();
  await expect(stage.locator('[data-model-layer="model-neutral-shoes"]')).toBeVisible();
  await expect(pose).toHaveCount(0);
  await expect(cover).toHaveCount(0);
  await expect(stage.locator('[data-garment="dress-strapless-deep-fold-denim"]')).toBeVisible();
  await expect(stage.getByTestId('user-face-sprite')).toBeVisible();
  await expect(stage.getByTestId('user-hair-hat-overlay')).toBeVisible();
  expect(await highBoots.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(24);
  expect(await legwear.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBe(25);
});
