import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { readdir } from "node:fs/promises";

function watchBrowserHealth(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const message = request.failure()?.errorText ?? "unknown";
    if (!message.includes("ERR_ABORTED")) failedRequests.push(`${request.url()} (${message})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  return { consoleErrors, pageErrors, failedRequests, badResponses };
}

async function expectLoadedStage(page: Page) {
  await expect(page.getByTestId("studio-stage")).toBeVisible();
  await expect.poll(() => page.getByTestId("studio-stage").locator("img").evaluateAll((images) =>
    images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 1024 && (image as HTMLImageElement).naturalHeight === 1536),
  )).toBe(true);
}

async function waitForVisiblePreviews(page: Page) {
  await page.locator("#garment-panel img").evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      const source = (image as HTMLImageElement).src;
      const probe = new Image();
      probe.src = source;
      await probe.decode();
    }));
  });
}

async function selectCategory(page: Page, category: "tops" | "bottoms" | "shoes") {
  const launcher = page.getByTestId("category-launcher");
  if (await launcher.getAttribute("aria-expanded") !== "true") {
    await launcher.click();
  }
  await page.getByTestId(`category-${category}`).click();
}

test("14 ảnh sản phẩm có alpha thật và không mang viền nền trắng", async () => {
  const directory = "public/game/studio/products-v2";
  const files = (await readdir(directory)).filter((file) => file.endsWith(".png"));
  expect(files).toHaveLength(14);
  for (const file of files) {
    const metadata = await sharp(`${directory}/${file}`).metadata();
    expect(metadata.hasAlpha, file).toBe(true);
    const { data, info } = await sharp(`${directory}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0, borderOpaque = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha === 0) transparent++;
        if ((x < 4 || y < 4 || x >= info.width - 4 || y >= info.height - 4) && alpha > 0) borderOpaque++;
      }
    }
    expect(transparent / (info.width * info.height), file).toBeGreaterThan(.2);
    expect(borderOpaque, file).toBe(0);
  }
});

test("kéo cột phải và hai cột quần váy chỉ mang sticker trong suốt", async ({ page }) => {
  await page.goto("/play");
  await expectLoadedStage(page);
  for (const [category, id] of [
    ["tops", "top-black-tee"],
    ["bottoms", "bottom-blue-jeans"],
    ["bottoms", "bottom-white-shorts"],
    ["bottoms", "bottom-navy-dots"],
    ["shoes", "shoes-mary-janes"],
  ] as const) {
    await selectCategory(page, category);
    const card = page.getByTestId(`garment-${id}`);
    await card.scrollIntoViewIfNeeded();
    await waitForVisiblePreviews(page);
    const source = card.locator("img");
    await expect(source).toHaveAttribute("src", `/game/studio/products-v2/${id}.png`);
    const box = (await source.boundingBox())!;
    const stage = (await page.getByTestId("studio-stage").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .35, { steps: 10 });
    const ghost = page.locator(".garment-drag-preview");
    await expect(ghost).toHaveCSS("opacity", "1");
    await expect(ghost.locator("img")).toHaveAttribute("src", await source.getAttribute("src") as string);
    const held = (await ghost.boundingBox())!;
    expect(held.width).toBeCloseTo(box.width, 0);
    expect(held.height).toBeCloseTo(box.height, 0);
    await page.screenshot({ path: `artifacts/studio-qa/products/drag-${id}.png` });
    await page.mouse.up();
    await expect(ghost).toHaveCount(0);
    await expect(page.locator(`[data-garment="${id}"]`)).toBeVisible();
  }
});

test("PLAY tải model thẳng và duyệt đúng số món theo nhóm (6 áo, 6 quần/váy, 2 giày)", async ({ page }) => {
  const health = watchBrowserHealth(page);
  await page.goto("/play");
  await expectLoadedStage(page);
  await expect(page.getByTestId("studio-stage")).toHaveAttribute("data-layer-count", "0");
  await expect(page.getByAltText("Nhân vật 2D cố định đứng thẳng, hai tay xuôi tự nhiên")).toBeVisible();

  const expectedCounts = {
    tops: 6,
    bottoms: 6,
    shoes: 2,
  } as const;

  for (const [category, count] of Object.entries(expectedCounts)) {
    await selectCategory(page, category as keyof typeof expectedCounts);
    await expect(page.locator('[data-testid^="garment-"]')).toHaveCount(count);
    await expect(page.getByTestId(`category-${category}`)).toHaveAttribute("aria-selected", "true");
  }

  await selectCategory(page, "tops");
  await waitForVisiblePreviews(page);
  const wardrobeScroll = page.locator(".wardrobe-scroll");
  await expect.poll(() => wardrobeScroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await wardrobeScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(page.getByTestId("garment-top-red-offshoulder")).toBeInViewport();
  await wardrobeScroll.evaluate((element) => element.scrollTo({ top: 0 }));
  await page.mouse.move(8, 900);
  await expect(page.getByTestId("category-launcher")).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ path: "artifacts/studio-qa/play-desktop.png", fullPage: true });
  expect(health.consoleErrors).toEqual([]);
  expect(health.pageErrors).toEqual([]);
  expect(health.failedRequests).toEqual([]);
  expect(health.badResponses).toEqual([]);
});

test("chọn nhóm độc lập áo, quần, giày phối hợp tự nhiên", async ({ page }) => {
  await page.goto("/play");

  await page.getByTestId("garment-top-white-basic").click();
  await selectCategory(page, "bottoms");
  await page.getByTestId("garment-bottom-blue-jeans").click();
  await selectCategory(page, "shoes");
  await page.getByTestId("garment-shoes-mary-janes").click();

  await expect(page.getByTestId("studio-stage")).toHaveAttribute("data-layer-count", "3");
  await expect(page.locator('[data-garment="top-white-basic"]')).toBeVisible();
  await expect(page.locator('[data-garment="bottom-blue-jeans"]')).toBeVisible();
  await expect(page.locator('[data-garment="shoes-mary-janes"]')).toBeVisible();

  await page.getByTestId("category-launcher").hover();
  await page.getByTestId("category-shoes").click();
  await page.getByTestId("garment-shoes-brown-boots").click();
  await expect(page.locator('[data-garment="bottom-blue-jeans"]')).toHaveClass(/is-shortened-for-boots/);

  await selectCategory(page, "bottoms");
  await page.getByTestId("garment-bottom-gray-maxi").click();
  await expect(page.locator('[data-garment="bottom-gray-maxi"]')).not.toHaveClass(/is-shortened-for-boots/);
  await expect(page.getByTestId("studio-stage").locator("img").first()).toHaveAttribute("src", /model-boots/);
  await page.getByRole("button", { name: "Show my look" }).click();
  await expect(page.getByTestId("studio-stage")).toHaveClass(/is-showcasing/);
  await expect(page.getByTestId("studio-stage")).not.toHaveClass(/is-showcasing/, { timeout: 4000 });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: "artifacts/studio-qa/completed-look-boots.png", fullPage: true });

  await selectCategory(page, "tops");
  await page.getByTestId("garment-top-black-tee").click();
  await expect(page.locator('[data-garment="top-white-basic"]')).toHaveCount(0);
  await expect(page.locator('[data-garment="top-black-tee"]')).toBeVisible();
});

test("nút tủ đồ mở bánh xe, sau đó đổi danh mục bằng hover và click", async ({ page }) => {
  await page.goto("/play");
  await expectLoadedStage(page);

  await expect(page.getByTestId("category-launcher")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("category-launcher")).toContainText("Wardrobe");
  const launcherBox = (await page.getByTestId("category-launcher").boundingBox())!;
  const panelBox = (await page.locator(".wardrobe").boundingBox())!;
  expect(Math.abs(launcherBox.x + launcherBox.width - panelBox.x)).toBeLessThan(2);
  await page.getByTestId("category-launcher").hover();
  await expect(page.getByTestId("category-launcher")).toHaveAttribute("aria-expanded", "true");

  // Hover on bottoms sector switches category after the wheel opens
  await page.getByTestId("category-bottoms").hover();
  await expect(page.getByTestId("category-bottoms")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("garment-bottom-black-mini")).toBeVisible();

  // Hover on shoes sector switches category
  await page.getByTestId("category-shoes").hover();
  await expect(page.getByTestId("category-shoes")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("garment-shoes-brown-boots")).toBeVisible();

  // Click on tops sector switches back
  await page.getByTestId("category-tops").click();
  await expect(page.getByTestId("category-tops")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("garment-top-red-offshoulder")).toBeVisible();
});

test("kéo thả món đồ vào khung nhân vật để mặc đồ kèm hiệu ứng", async ({ page }) => {
  await page.goto("/play");
  await expectLoadedStage(page);

  // Inspect the actual pointer-held sticker before releasing the mouse.
  const firstImage = page.getByTestId("garment-top-white-basic").locator("img");
  await waitForVisiblePreviews(page);
  const imageBox = (await firstImage.boundingBox())!;
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x - 50, imageBox.y + 50, { steps: 8 });
  const ghost = page.locator(".garment-drag-preview");
  await expect(ghost).toBeVisible();
  await expect(ghost).toHaveCSS("opacity", "1");
  const ghostBox = (await ghost.boundingBox())!;
  expect(ghostBox.width).toBeCloseTo(imageBox.width, 0);
  expect(ghostBox.height).toBeCloseTo(imageBox.height, 0);
  await page.screenshot({ path: "artifacts/studio-qa/drag-sticker.png" });
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  await expect(page.getByTestId("studio-stage")).toHaveAttribute("data-layer-count", "0");

  // Drag top-red-offshoulder onto studio-stage
  const redTopCard = page.getByTestId("garment-top-red-offshoulder");
  const stage = page.getByTestId("studio-stage");
  await redTopCard.dragTo(stage);

  await expect(page.locator('[data-garment="top-red-offshoulder"]')).toBeVisible();
  await expect(page.getByTestId("studio-stage")).toHaveAttribute("data-layer-count", "1");

  // Hover on bottoms wheel sector to switch category
  await page.getByTestId("category-launcher").hover();
  await page.getByTestId("category-bottoms").hover();
  await expect(page.getByTestId("category-bottoms")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("garment-bottom-black-mini")).toBeVisible();

  // Drag black mini skirt onto stage
  await page.getByTestId("garment-bottom-black-mini").dragTo(stage);
  await expect(page.locator('[data-garment="bottom-black-mini"]')).toBeVisible();
  await expect(page.getByTestId("studio-stage")).toHaveAttribute("data-layer-count", "2");
});

test("PLAY dùng được ở mobile và không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play");
  await expectLoadedStage(page);
  await selectCategory(page, "shoes");
  await page.getByTestId("garment-shoes-mary-janes").click();
  await expect(page.locator('[data-garment="shoes-mary-janes"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.mouse.move(0, 0);
  const mobileLauncher = (await page.getByTestId("category-launcher").boundingBox())!;
  expect(mobileLauncher.x).toBeGreaterThanOrEqual(0);
  expect(mobileLauncher.x + mobileLauncher.width).toBeLessThanOrEqual(390);
  await waitForVisiblePreviews(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/studio-qa/play-mobile.png", fullPage: true });
});
