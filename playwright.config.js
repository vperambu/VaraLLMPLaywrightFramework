/**
 * ═══════════════════════════════════════════════════════════════════
 * playwright.config.js — varaTestAiFramework Playwright Configuration
 * ═══════════════════════════════════════════════════════════════════
 */
import { defineConfig, devices } from '@playwright/test';
import { frameworkConfig } from './config/framework.config.js';

export default defineConfig({
  testDir: './features',
  timeout: frameworkConfig.playwright.defaultTimeout,
  retries: frameworkConfig.playwright.retryAttempts,
  workers: 2,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
    ['list'],
  ],

  use: {
    baseURL: frameworkConfig.app.baseUrl,
    headless: frameworkConfig.playwright.headless,
    slowMo: frameworkConfig.playwright.slowMo,
    viewport: frameworkConfig.playwright.viewport,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
});
