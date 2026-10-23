import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 30000,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined,
    baseURL: "http://127.0.0.1:3000",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    {
      command: "node e2e/fixture-server.mjs",
      url: "http://127.0.0.1:4174/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:3000/carrito",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:4174",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_fixture",
        SUPABASE_URL: "http://127.0.0.1:4174",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_fixture",
      },
    },
  ],
});
