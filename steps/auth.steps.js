/**
 * ═══════════════════════════════════════════════════════════════════
 * steps/auth.steps.js — UI Authentication Step Definitions
 *
 * Reusability Policy:
 *  - Steps from shared.steps.js are intentionally NOT duplicated here.
 *  - New steps are added only when shared coverage is insufficient.
 *  - SmartGen pipeline tracks reuse % for this file.
 * ═══════════════════════════════════════════════════════════════════
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';

// ════════════════════════════════════════════════════════════════════
// GIVEN
// ════════════════════════════════════════════════════════════════════

Given('I am on the login page', async function () {
  const loginPage = new LoginPage(this.page);
  await loginPage.navigate();
  this.set('loginPage', loginPage);
  this.set('dashboardPage', new DashboardPage(this.page));
});

Given('I am logged in as {string} with password {string}', async function (username, password) {
  const loginPage = new LoginPage(this.page);
  await loginPage.navigate();
  await loginPage.login(username, password);
  const dashboardPage = new DashboardPage(this.page);
  await dashboardPage.waitForLoad();
  this.set('loginPage', loginPage);
  this.set('dashboardPage', dashboardPage);
});

Given('I have an account with MFA enabled', async function () {
  // Stub: In real implementation this would set up test user state via API
  this.set('mfaEnabled', true);
  console.log('ℹ️  MFA stub: user state configured');
});

// ════════════════════════════════════════════════════════════════════
// WHEN
// ════════════════════════════════════════════════════════════════════

When('I enter username {string} and password {string}', async function (username, password) {
  const loginPage = this.get('loginPage');
  await loginPage.login(username, password);
});

When('I click the sign in button', async function () {
  // Login button is clicked as part of login() — this step is a semantic alias
  // for feature file readability when credentials are entered in separate steps.
  const loginPage = this.get('loginPage');
  await loginPage.loginButton.click();
});

When('I enter the MFA code {string}', async function (code) {
  const loginPage = this.get('loginPage');
  await loginPage.mfaCodeInput.fill(code);
});

When('I submit the MFA code', async function () {
  const loginPage = this.get('loginPage');
  await loginPage.mfaSubmit.click();
});

When('I click the user menu', async function () {
  const dashboardPage = this.get('dashboardPage');
  await dashboardPage.userMenu.click();
});

When('I click the logout button', async function () {
  const dashboardPage = this.get('dashboardPage');
  await dashboardPage.logout();
});

// ════════════════════════════════════════════════════════════════════
// THEN
// ════════════════════════════════════════════════════════════════════

Then('I should be redirected to the dashboard', async function () {
  const dashboardPage = this.get('dashboardPage');
  await dashboardPage.assertUrl(/dashboard/);
  await dashboardPage.waitForLoad();
});

Then('I should see a personalized welcome message', async function () {
  const dashboardPage = this.get('dashboardPage');
  const heading = await dashboardPage.welcomeHeader.innerText();
  expect(heading.length).toBeGreaterThan(0);
});

Then('I should see an error message containing {string}', async function (errorText) {
  const loginPage = this.get('loginPage');
  await loginPage.assertErrorMessage(errorText);
});

Then('I should remain on the login page', async function () {
  await expect(this.page).toHaveURL(/login/);
});

Then('I should see the MFA verification prompt', async function () {
  const loginPage = this.get('loginPage');
  const isMfaVisible = await loginPage.isMfaPromptVisible();
  expect(isMfaVisible).toBe(true);
});

Then('I should be redirected to the login page', async function () {
  await expect(this.page).toHaveURL(/login/, {
    timeout: 10_000,
  });
});

Then('I should not be able to access the dashboard directly', async function () {
  await this.page.goto('/dashboard');
  // Should redirect back to login
  await expect(this.page).toHaveURL(/login/);
});
