/**
 * ═══════════════════════════════════════════════════════════════════
 * pages/LoginPage.js — Login Page Object
 *
 * Locator Strategy: 100% ARIA / TestId / Label — zero CSS or XPath.
 * WAI-ARIA compliance ensures resilience against UI refactors.
 * ═══════════════════════════════════════════════════════════════════
 */
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    super(page);

    // ── Locators (defined once in constructor) ─────────────────
    // Priority: getByRole → getByTestId → getByLabel
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton   = page.getByRole('button', { name: /sign in|log in/i });
    this.errorMessage  = page.getByRole('alert');
    this.forgotLink    = page.getByRole('link', { name: /forgot password/i });
    this.mfaCodeInput  = page.getByLabel('Authentication Code');
    this.mfaSubmit     = page.getByRole('button', { name: /verify/i });

    // TestId fallbacks (when aria labels are missing)
    this.usernameInputFallback = page.getByTestId('username-input');
    this.passwordInputFallback = page.getByTestId('password-input');
    this.loginButtonFallback   = page.getByTestId('login-submit-button');
  }

  // ════════════════════════════════════════════════════════════════
  // Actions
  // ════════════════════════════════════════════════════════════════

  /**
   * Navigates to the login page.
   */
  async navigate() {
    await super.navigate('/login');
    await this.waitForVisible(this.loginButton);
  }

  /**
   * Fills in credentials and submits the login form.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    // Prefer ARIA label; fall back to test ID
    const usernameEl = await this._resolveLocator(this.usernameInput, this.usernameInputFallback);
    const passwordEl = await this._resolveLocator(this.passwordInput, this.passwordInputFallback);
    const submitEl   = await this._resolveLocator(this.loginButton, this.loginButtonFallback);

    await usernameEl.clear();
    await usernameEl.fill(username);
    await passwordEl.clear();
    await passwordEl.fill(password);
    await submitEl.click();
  }

  /**
   * Submits MFA verification code.
   * @param {string} code
   */
  async submitMfaCode(code) {
    await this.waitForVisible(this.mfaCodeInput);
    await this.mfaCodeInput.fill(code);
    await this.mfaSubmit.click();
  }

  /**
   * Clicks 'Forgot Password' link.
   */
  async clickForgotPassword() {
    await this.forgotLink.click();
  }

  // ════════════════════════════════════════════════════════════════
  // Queries / Assertions
  // ════════════════════════════════════════════════════════════════

  /**
   * Returns the visible error message text.
   * @returns {Promise<string>}
   */
  async getErrorMessage() {
    await this.waitForVisible(this.errorMessage);
    return this.errorMessage.innerText();
  }

  /**
   * Asserts the error message matches expected text.
   * @param {string|RegExp} expected
   */
  async assertErrorMessage(expected) {
    await this.assertVisible(this.errorMessage);
    const text = await this.getErrorMessage();
    if (expected instanceof RegExp) {
      if (!expected.test(text)) {
        throw new Error(`Error message "${text}" did not match ${expected}`);
      }
    } else if (!text.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(`Expected error to contain "${expected}", got "${text}"`);
    }
  }

  /**
   * Asserts no error alert is shown.
   */
  async assertNoError() {
    const errorCount = await this.errorMessage.count();
    if (errorCount > 0) {
      const text = await this.errorMessage.innerText();
      throw new Error(`Unexpected error shown: "${text}"`);
    }
  }

  /**
   * Checks if the MFA prompt is visible.
   * @returns {Promise<boolean>}
   */
  async isMfaPromptVisible() {
    return this.mfaCodeInput.isVisible();
  }

  // ════════════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════════════

  /**
   * Resolves to the first visible locator (primary or fallback).
   * @param {import('playwright').Locator} primary
   * @param {import('playwright').Locator} fallback
   */
  async _resolveLocator(primary, fallback) {
    try {
      await primary.waitFor({ state: 'visible', timeout: 3000 });
      return primary;
    } catch {
      return fallback;
    }
  }
}
