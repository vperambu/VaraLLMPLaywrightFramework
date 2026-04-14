/**
 * ═══════════════════════════════════════════════════════════════════
 * pages/DashboardPage.js — Dashboard Page Object
 *
 * Represents the post-login authenticated dashboard.
 * All locators use WAI-ARIA role/testId strategy.
 * ═══════════════════════════════════════════════════════════════════
 */
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    super(page);

    // ── Navigation ─────────────────────────────────────────────
    this.navMenu       = page.getByRole('navigation', { name: 'Main Navigation' });
    this.userMenu      = page.getByRole('button', { name: /account|profile|user/i });
    this.logoutButton  = page.getByRole('menuitem', { name: /sign out|log out/i });

    // ── Dashboard Content ──────────────────────────────────────
    this.welcomeHeader   = page.getByRole('heading', { level: 1 });
    this.dashboardWidget = page.getByTestId('dashboard-widget');
    this.loadingSpinner  = page.getByRole('progressbar');

    // ── Notification Banner ────────────────────────────────────
    this.successBanner = page.getByRole('status');
    this.errorBanner   = page.getByRole('alert');
  }

  /**
   * Waits for the dashboard to fully load (no spinner visible).
   */
  async waitForLoad() {
    await this.waitForHidden(this.loadingSpinner);
    await this.waitForVisible(this.welcomeHeader);
  }

  /**
   * Asserts the user is on the dashboard with a personalized welcome.
   * @param {string} [expectedUsername]
   */
  async assertLoggedIn(expectedUsername) {
    await this.assertUrl(/dashboard/);
    await this.waitForLoad();
    if (expectedUsername) {
      const heading = await this.welcomeHeader.innerText();
      if (!heading.toLowerCase().includes(expectedUsername.toLowerCase())) {
        throw new Error(`Expected welcome for "${expectedUsername}", got "${heading}"`);
      }
    }
  }

  /**
   * Opens a nav section by its accessible name.
   * @param {string} sectionName
   */
  async navigateTo(sectionName) {
    await this.clickByRole('link', { name: sectionName });
    await this.waitForNavigation();
  }

  /**
   * Logs out the current user.
   */
  async logout() {
    await this.userMenu.click();
    await this.waitForVisible(this.logoutButton);
    await this.logoutButton.click();
    await this.waitForNavigation();
  }

  /**
   * Returns text of success notification banner.
   * @returns {Promise<string>}
   */
  async getSuccessMessage() {
    await this.waitForVisible(this.successBanner);
    return this.successBanner.innerText();
  }
}
