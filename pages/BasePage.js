/**
 * ═══════════════════════════════════════════════════════════════════
 * pages/BasePage.js — Base Page Object with Shared Utilities
 *
 * Design Principles:
 *  - ALL locators use role/testId/label (zero CSS/XPath)
 *  - Built-in retry and soft assertion utilities
 *  - WAI-ARIA first — guarantees accessibility signal compliance
 * ═══════════════════════════════════════════════════════════════════
 */
import { expect } from '@playwright/test';
import { frameworkConfig } from '../config/framework.config.js';

export class BasePage {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this.page = page;
    this.timeout = frameworkConfig.playwright.defaultTimeout;
  }

  // ════════════════════════════════════════════════════════════════
  // Navigation
  // ════════════════════════════════════════════════════════════════

  /**
   * Navigates to a path relative to baseURL, waits for network idle.
   * @param {string} path
   */
  async navigate(path = '/') {
    await this.page.goto(path, {
      waitUntil: 'networkidle',
      timeout: frameworkConfig.playwright.navigationTimeout,
    });
  }

  /**
   * Returns the current page title.
   */
  async getTitle() {
    return this.page.title();
  }

  /**
   * Returns the current page URL.
   */
  getCurrentUrl() {
    return this.page.url();
  }

  // ════════════════════════════════════════════════════════════════
  // Locator Wrappers (WAI-ARIA First Strategy)
  // ════════════════════════════════════════════════════════════════

  /**
   * Preferred locator. Finds element by its ARIA role + accessible name.
   * @param {import('playwright').AriaRole} role
   * @param {import('playwright').PageGetByRoleOptions} [options]
   */
  getByRole(role, options) {
    return this.page.getByRole(role, options);
  }

  /**
   * Second-priority locator. Uses data-testid attribute.
   * @param {string} testId
   */
  getByTestId(testId) {
    return this.page.getByTestId(testId);
  }

  /**
   * Third-priority locator. Finds form elements by their label text.
   * @param {string} text
   */
  getByLabel(text) {
    return this.page.getByLabel(text);
  }

  /**
   * Fourth-priority locator. Finds elements by visible text.
   * @param {string|RegExp} text
   */
  getByText(text) {
    return this.page.getByText(text);
  }

  /**
   * Fourth-priority locator. Finds inputs by placeholder text.
   * @param {string} text
   */
  getByPlaceholder(text) {
    return this.page.getByPlaceholder(text);
  }

  // ════════════════════════════════════════════════════════════════
  // Interaction Helpers
  // ════════════════════════════════════════════════════════════════

  /**
   * Clicks an element by role. Waits for it to be visible first.
   * @param {import('playwright').AriaRole} role
   * @param {import('playwright').PageGetByRoleOptions} options
   */
  async clickByRole(role, options) {
    const el = this.getByRole(role, options);
    await el.waitFor({ state: 'visible', timeout: this.timeout });
    await el.click();
  }

  /**
   * Fills a form field located by its label.
   * @param {string} label
   * @param {string} value
   */
  async fillByLabel(label, value) {
    const el = this.getByLabel(label);
    await el.waitFor({ state: 'visible', timeout: this.timeout });
    await el.clear();
    await el.fill(value);
  }

  /**
   * Fills a form field located by its test ID.
   * @param {string} testId
   * @param {string} value
   */
  async fillByTestId(testId, value) {
    const el = this.getByTestId(testId);
    await el.waitFor({ state: 'visible', timeout: this.timeout });
    await el.clear();
    await el.fill(value);
  }

  /**
   * Selects a dropdown option by its visible label.
   * @param {import('playwright').AriaRole} role
   * @param {import('playwright').PageGetByRoleOptions} roleOpts
   * @param {string} optionText
   */
  async selectOptionByLabel(role, roleOpts, optionText) {
    await this.page.getByRole(role, roleOpts).selectOption({ label: optionText });
  }

  // ════════════════════════════════════════════════════════════════
  // Wait Utilities
  // ════════════════════════════════════════════════════════════════

  /**
   * Waits for an element to be visible.
   * @param {import('playwright').Locator} locator
   * @param {number} [timeout]
   */
  async waitForVisible(locator, timeout = this.timeout) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Waits for an element to be hidden/detached.
   * @param {import('playwright').Locator} locator
   * @param {number} [timeout]
   */
  async waitForHidden(locator, timeout = this.timeout) {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Waits for page navigation to complete.
   */
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Polls until condition is true or timeout expires.
   * @param {() => Promise<boolean>} condition
   * @param {number} [timeout]
   * @param {number} [interval]
   */
  async waitUntil(condition, timeout = this.timeout, interval = 500) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await this.page.waitForTimeout(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  // ════════════════════════════════════════════════════════════════
  // Assertions
  // ════════════════════════════════════════════════════════════════

  /**
   * Asserts that an element is visible (hard assertion).
   * @param {import('playwright').Locator} locator
   * @param {string} [msg]
   */
  async assertVisible(locator, msg) {
    await expect(locator, msg).toBeVisible({ timeout: this.timeout });
  }

  /**
   * Asserts that a URL matches a pattern.
   * @param {string|RegExp} urlPattern
   */
  async assertUrl(urlPattern) {
    await expect(this.page).toHaveURL(urlPattern, { timeout: this.timeout });
  }

  /**
   * Asserts the page title.
   * @param {string|RegExp} titlePattern
   */
  async assertTitle(titlePattern) {
    await expect(this.page).toHaveTitle(titlePattern, { timeout: this.timeout });
  }

  /**
   * Soft assertion wrapper — logs failure but doesn't halt the test.
   * @param {() => Promise<void>} assertionFn
   * @param {string} label
   */
  async softAssert(assertionFn, label) {
    try {
      await assertionFn();
    } catch (err) {
      console.warn(`⚠️  Soft assertion failed [${label}]:`, err.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Miscellaneous Utilities
  // ════════════════════════════════════════════════════════════════

  /**
   * Dismisses a browser alert/confirm/prompt dialog.
   * @param {'accept'|'dismiss'} action
   * @param {string} [promptText]
   */
  async handleDialog(action = 'accept', promptText) {
    this.page.once('dialog', async (dialog) => {
      if (promptText) {
        await dialog.accept(promptText);
      } else if (action === 'accept') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Takes a full-page screenshot and returns as Buffer.
   * @param {string} [label]
   */
  async screenshot(label = 'snapshot') {
    return this.page.screenshot({ fullPage: true });
  }

  /**
   * Scrolls element into the viewport.
   * @param {import('playwright').Locator} locator
   */
  async scrollIntoView(locator) {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Returns the accessible name of an element.
   * @param {import('playwright').Locator} locator
   */
  async getAccessibleName(locator) {
    return locator.getAttribute('aria-label');
  }
}
