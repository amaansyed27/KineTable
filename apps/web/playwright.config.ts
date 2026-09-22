import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", timeout: 45000, workers: 1, reporter: "list",
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, storageState: process.env.E2E_STORAGE_STATE, baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4174", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm exec vite preview --host 127.0.0.1 --port 4174 --strictPort", url: "http://127.0.0.1:4174", reuseExistingServer: false },
});
