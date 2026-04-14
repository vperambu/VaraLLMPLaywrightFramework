/**
 * ═══════════════════════════════════════════════════════════════════
 * support/world.js — Custom Cucumber World with Dependency Injection
 *
 * The World object is created fresh for EACH scenario. It holds:
 *  - Playwright browser context and page
 *  - API request context
 *  - Scenario metadata for AI analytics
 *  - Shared state bag for step-to-step data passing
 * ═══════════════════════════════════════════════════════════════════
 */
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { chromium, firefox, webkit, request } from 'playwright';
import { frameworkConfig } from '../config/framework.config.js';

class PlaywrightWorld extends World {
  constructor(options) {
    super(options);

    // ── Playwright Primitives ──────────────────────────────────
    /** @type {import('playwright').Browser} */
    this.browser = null;
    /** @type {import('playwright').BrowserContext} */
    this.context = null;
    /** @type {import('playwright').Page} */
    this.page = null;
    /** @type {import('playwright').APIRequestContext} */
    this.apiContext = null;

    // ── Scenario Metadata ─────────────────────────────────────
    this.scenarioName = '';
    this.scenariTags = [];
    this.startTime = null;

    // ── Shared State Bag (step-to-step data) ──────────────────
    /** @type {Record<string, any>} */
    this.state = {};

    // ── AI Log Ingestion Buffer ────────────────────────────────
    // Collects events during the scenario for analytics pipeline
    this.aiLog = {
      scenario: '',
      tags: [],
      steps: [],          // { name, status, duration, error }
      consoleErrors: [],
      networkFailures: [],
      startTime: null,
      endTime: null,
    };
  }

  /**
   * Opens a fresh browser context scoped to the current scenario.
   * Called from the Before hook.
   */
  async openBrowser() {
    const browserType = process.env.BROWSER || 'chromium';
    const browserEngines = { chromium, firefox, webkit };
    const engine = browserEngines[browserType] || chromium;

    this.browser = await engine.launch({
      headless: frameworkConfig.playwright.headless,
      slowMo: frameworkConfig.playwright.slowMo,
    });

    this.context = await this.browser.newContext({
      baseURL: frameworkConfig.app.baseUrl,
      viewport: frameworkConfig.playwright.viewport,
      recordVideo: {
        dir: frameworkConfig.reporting.videosDir,
        size: frameworkConfig.playwright.viewport,
      },
      ignoreHTTPSErrors: true,
    });

    // ── Attach tracing ─────────────────────────────────────────
    await this.context.tracing.start(frameworkConfig.playwright.tracing);

    this.page = await this.context.newPage();

    // ── AI: Wire console & network event collectors ────────────
    this._wirePageEventCollectors();
  }

  /**
   * Creates a standalone API request context (no browser needed).
   * Called from the Before hook for @api tagged scenarios.
   */
  async openApiContext() {
    this.apiContext = await request.newContext({
      baseURL: frameworkConfig.app.apiBaseUrl,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * Closes browser, context, and API request context.
   * Called from the After hook.
   */
  async closeBrowser() {
    if (this.context) {
      await this.context.tracing.stop({
        path: `${frameworkConfig.reporting.tracesDir}/${this._safeFileName(this.scenarioName)}.zip`,
      });
    }
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    if (this.apiContext) {
      await this.apiContext.dispose();
    }
  }

  /**
   * Captures a screenshot and attaches it to the Cucumber report.
   */
  async captureScreenshot(label = 'screenshot') {
    if (!this.page || this.page.isClosed()) return;
    const buffer = await this.page.screenshot({ fullPage: true });
    await this.attach(buffer, 'image/png');
    console.log(`📸 Screenshot captured: ${label}`);
  }

  /**
   * Sets a named value in the shared state bag.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.state[key] = value;
  }

  /**
   * Retrieves a value from the shared state bag.
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    return this.state[key];
  }

  // ── Private Helpers ────────────────────────────────────────────

  _wirePageEventCollectors() {
    // Collect browser console errors
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.aiLog.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: Date.now(),
        });
      }
    });

    // Collect failed network requests
    this.page.on('response', async (response) => {
      if (response.status() >= 400) {
        this.aiLog.networkFailures.push({
          url: response.url(),
          status: response.status(),
          timestamp: Date.now(),
        });
      }
    });
  }

  _safeFileName(name) {
    return name
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 80);
  }
}

setWorldConstructor(PlaywrightWorld);
