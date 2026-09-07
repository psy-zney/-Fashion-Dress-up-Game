import { expect, test } from "@playwright/test";

test("màn hình mở đầu chỉ dẫn PLAY vào phòng phối đồ tích hợp", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator(".landing-shell")).toHaveCSS("background-color", "rgb(87, 126, 120)");
  await page.screenshot({ path: "artifacts/studio/qa/landing-background.png", fullPage: true });
  await expect(page.getByRole("link", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /STUDIO 2D/i })).toHaveCount(0);

  await page.getByRole("link", { name: "PLAY", exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("studio-stage")).toBeVisible();
  expect(errors).toEqual([]);
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

test("các URL phòng mẫu cũ chuyển vào PLAY, route sai vẫn 404", async ({ page }) => {
  for (const url of ["/studio", "/desktop/1", "/desktop/2", "/desktop/3", "/desktop/4", "/desktop/5"]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("studio-stage")).toBeVisible();
  }

  const response = await page.goto("/desktop/6");
  expect(response?.status()).toBe(404);
});
