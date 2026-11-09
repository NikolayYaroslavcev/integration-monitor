import { defineConfig, devices } from '@playwright/test';

const PORT = 3005;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'npm run build && npm start',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
