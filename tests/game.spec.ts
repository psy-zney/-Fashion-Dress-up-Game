import { expect, test } from "@playwright/test";

test("màn hình mở đầu chỉ dẫn PLAY vào phòng phối đồ tích hợp", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator(".landing-shell")).toHaveCSS("background-color", "rgb(87, 126, 120)");
  await page.screenshot({ path: "artifacts/studio/qa/landing-background.png", fullPage: true });
  await expect(page.getByRole("link", { name: "PLAY", exact: true })).toHaveCount(0);
  await page.locator(".landing-tap-notification").click({ force: true });
  await expect(page.getByRole("link", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /STUDIO 2D/i })).toHaveCount(0);

  await page.getByRole("link", { name: "PLAY", exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("studio-stage")).toBeVisible();
  expect(errors).toEqual([]);
});

test("PLAY dùng nền Figma có deploy version và giữ tỉ lệ model desktop", async ({ page, request }) => {
  await page.goto("/play");

  const versionResponse = await request.get(`/deploy-version.json?t=${Date.now()}`);
  expect(versionResponse.ok()).toBe(true);
  const { version } = await versionResponse.json() as { version: string };

  const room = page.locator(".dressing-room-content");
  const backgroundImage = await room.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(backgroundImage).toContain("/game/backgrounds/slide-playground.webp?v=");
  expect(backgroundImage).toContain(encodeURIComponent(version));

  const backgroundUrl = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
  expect(backgroundUrl).toBeTruthy();
  const backgroundResponse = await request.get(backgroundUrl!);
  expect(backgroundResponse.ok()).toBe(true);

  const stage = (await page.getByTestId("studio-stage").boundingBox())!;
  expect(stage.width / stage.height).toBeCloseTo(2 / 3, 2);
  expect(stage.x).toBeGreaterThan(195);
  expect(stage.x).toBeLessThan(220);
  expect(stage.y).toBeGreaterThan(80);
  expect(stage.y).toBeLessThan(100);
  expect(stage.y + stage.height).toBeLessThan(910);
});

test("hướng dẫn mở, giữ focus, đóng bằng Escape và trả focus", async ({ page }) => {
  await page.goto("/");
  const help = page.getByRole("button", { name: "How to play" });
  await help.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Got it, let’s play" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(help).toBeFocused();
});

test("background parallax và model là layer kéo đàn hồi", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 1024 });

  const canvas = page.locator(".game-canvas");
  const background = page.locator(".landing-background-layer");
  const model = page.getByTestId("landing-model-layer");

  await expect(model).toHaveAttribute("data-effects-ready", "false");
  const tapNotification = page.locator(".landing-tap-notification");
  await tapNotification.waitFor({ state: "visible" });
  await tapNotification.click({ force: true });
  await expect(model).toHaveAttribute("data-effects-ready", "true");
  await expect(model.locator(".landing-clothing")).toHaveCount(4);

  const modelBox = (await model.boundingBox())!;

  await page.mouse.move(1300, 850);
  await expect.poll(async () => background.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe("none");

  await page.mouse.move(modelBox.x + modelBox.width * 0.55, modelBox.y + modelBox.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(modelBox.x + modelBox.width * 0.55 + 90, modelBox.y + modelBox.height * 0.45 + 45);
  await expect(model).toHaveAttribute("data-dragging", "true");
  await expect.poll(async () => model.evaluate((element) => element.style.getPropertyValue("--drag-x")))
    .not.toBe("0px");

  await page.mouse.up();
  await expect(model).not.toHaveAttribute("data-dragging", "true");
  await expect(model).toHaveCSS("cursor", "grab");
  await expect(canvas).toBeVisible();
});

test("các URL phòng mẫu cũ chuyển vào PLAY, route sai vẫn 404", async ({ page }) => {
  test.slow();
  for (const url of ["/studio", "/desktop/1", "/desktop/2", "/desktop/3", "/desktop/4", "/desktop/5"]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("studio-stage")).toBeVisible();
  }

  const response = await page.goto("/desktop/6");
  expect(response?.status()).toBe(404);
});
