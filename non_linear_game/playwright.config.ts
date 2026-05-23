import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 10_000,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "bun run src/index.tsx",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
