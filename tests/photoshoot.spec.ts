import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const saved = {
  selected: { tops: "top-fitted-denim", bottoms: "bottom-denim-sculpted-skirt", shoes: "shoes-mary-janes" },
  fits: { "top-fitted-denim": { x: 6, y: -4, scaleX: 1.02, scaleY: 0.98, angle: 1 } },
  held: { tops: true },
};

async function prepare(page: Page) {
  await page.addInitScript((look) => localStorage.setItem("tung-tung-play-ge", JSON.stringify(look)), saved);
}

async function mockCamera(page: Page) {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    Object.assign(window, { testCameraStreams: streams });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d")!;
      const paint = () => {
        context.fillStyle = "#10a040"; context.fillRect(0, 0, 320, 480);
        context.fillStyle = "#3040e0"; context.fillRect(320, 0, 320, 480);
      };
      paint();
      const stream = canvas.captureStream(15);
      const timer = setInterval(paint, 50);
      const track = stream.getVideoTracks()[0];
      const originalStop = track.stop.bind(track);
      track.stop = () => { clearInterval(timer); originalStop(); };
      const facing = ((constraints.video as MediaTrackConstraints).facingMode as ConstrainDOMStringParameters).ideal;
      track.getSettings = () => ({ facingMode: String(facing) });
      streams.push(stream);
      return stream;
    } });
  });
}

test("empty and damaged saves have a recoverable entry state", async ({ page }) => {
  await page.goto("/photoshoot");
  await expect(page.getByRole("link", { name: "Style outfit now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on camera" })).toBeDisabled();
  await page.evaluate(() => localStorage.setItem("tung-tung-play-ge", "{broken"));
  await page.reload();
  await expect(page.getByRole("link", { name: "Style outfit now" })).toBeVisible();
});

test("look survives navigation and reload; Figma background exports as PNG", async ({ page }) => {
  await prepare(page);
  await page.goto("/play");
  await page.getByRole("button", { name: "SHOW YOUR LOOK" }).click();
  await expect(page).toHaveURL(/\/photoshoot/);
  await expect(page.getByTestId("photoshoot-look")).toBeVisible();
  const look = await page.getByTestId("photoshoot-look").getAttribute("src");
  await page.reload();
  await expect(page.getByTestId("photoshoot-look")).toHaveAttribute("src", look!);
  await page.screenshot({ path: "artifacts/photoshoot/desktop.png" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  const download = await downloadPromise;
  const metadata = await sharp((await download.path())!).metadata();
  expect(metadata.width).toBe(1440);
  expect(metadata.height).toBe(1024);
  await page.getByRole("link", { name: "GO BACK" }).click();
  await expect(page.locator('[data-garment="top-fitted-denim"]')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tung-tung-play-ge")!))).toEqual(saved);
});

test("camera composition, movement, selfie mirroring, retake and stream cleanup", async ({ page }) => {
  await prepare(page);
  await mockCamera(page);
  await page.goto("/photoshoot");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeEnabled();
  const actor = page.getByRole("group", { name: "Character placement" });
  await actor.focus();
  await actor.press("ArrowRight");
  await expect(actor).toHaveAttribute("style", /52%/);
  await page.getByRole("slider", { name: "Character scale" }).fill("0.7");
  await expect(actor).toHaveAttribute("style", /height: 70%/);
  await page.screenshot({ path: "artifacts/photoshoot/camera.png" });
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await expect(page.getByTestId("photoshoot-result")).toBeVisible();
  const result = (await page.getByTestId("photoshoot-result").getAttribute("src"))!;
  const buffer = Buffer.from(result.split(",")[1], "base64");
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(1024);
  expect([...data.subarray(0, 4)]).toEqual([16, 160, 64, 255]);
  expect([...data.subarray((info.width - 1) * 4, info.width * 4)]).toEqual([48, 64, 224, 255]);
  // A camera-only result would contain just the two solid background colors.
  let characterPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 16 && data[i] !== 48) characterPixels++;
  }
  expect(characterPixels).toBeGreaterThan(10000);
  expect(await page.evaluate(() => (window as unknown as { testCameraStreams: MediaStream[] }).testCameraStreams.every((s) => s.getTracks().every((t) => t.readyState === "ended")))).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  const download = await downloadPromise;
  expect(await sharp((await download.path())!).raw().toBuffer()).toEqual(await sharp(buffer).raw().toBuffer());
  await page.getByRole("button", { name: "Retake photo", exact: true }).click();
  await page.getByRole("button", { name: "Switch camera" }).click();
  await expect(page.locator("video")).toHaveClass("is-mirrored");
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  const selfie = (await page.getByTestId("photoshoot-result").getAttribute("src"))!;
  const selfiePixels = await sharp(Buffer.from(selfie.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
  expect([...selfiePixels.subarray(0, 4)]).toEqual([48, 64, 224, 255]);
  await page.getByRole("button", { name: "Retake photo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "GO BACK" }).click();
  expect(await page.evaluate(() => (window as unknown as { testCameraStreams: MediaStream[] }).testCameraStreams.every((s) => s.getTracks().every((t) => t.readyState === "ended")))).toBe(true);
});

test("denied camera permission permits retry and saving the default scene", async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => { throw new DOMException("Denied", "NotAllowedError"); } }));
  await page.goto("/photoshoot");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.getByRole("status")).toContainText("permission denied");
  await expect(page.getByRole("button", { name: "Turn on camera" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "SAVE", exact: true })).toBeEnabled();
});

test("late permission response stops its stream after leaving photoshoot", async ({ page }) => {
  await prepare(page);
  await mockCamera(page);
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: (constraints: MediaStreamConstraints) => new Promise<MediaStream>((resolve) => {
      Object.assign(window, { resolveCamera: async () => resolve(await get(constraints)) });
    }) });
  });
  await page.goto("/photoshoot");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await page.getByRole("link", { name: "GO BACK" }).click();
  await expect(page).toHaveURL(/\/play/);
  await page.evaluate(() => (window as unknown as { resolveCamera: () => Promise<void> }).resolveCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { testCameraStreams: MediaStream[] }).testCameraStreams.every((s) => s.getTracks().every((t) => t.readyState === "ended")))).toBe(true);
});

test("mobile portrait and landscape keep camera and actions accessible", async ({ page }) => {
  await prepare(page);
  await mockCamera(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/photoshoot");
    await page.getByRole("button", { name: "Turn on camera" }).click();
    await expect(page.getByRole("button", { name: "Take photo", exact: true })).toBeEnabled();
    await expect(page.getByRole("link", { name: "GO BACK" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/photoshoot/mobile-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Take photo", exact: true }).click();
    await expect(page.getByTestId("photoshoot-result")).toBeVisible();
  }
});
