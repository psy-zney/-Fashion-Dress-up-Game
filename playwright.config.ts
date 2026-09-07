import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "2308";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: "**/mobile.spec.ts", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 1024 } } },
    { name: "mobile-chrome", testMatch: "**/mobile.spec.ts", use: { ...devices["Pixel 7"], browserName: "chromium", channel: "chrome" } },
    { name: "mobile-safari", testMatch: "**/mobile.spec.ts", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
