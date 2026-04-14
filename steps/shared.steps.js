/**
 * ═══════════════════════════════════════════════════════════════════
 * steps/shared.steps.js — Globally Reusable Step Definitions
 *
 * These steps are available to ALL feature files.
 * SmartGen pipeline prioritizes these before generating new ones.
 * Reusability target: ≥80% of generated steps should reference these.
 * ═══════════════════════════════════════════════════════════════════
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// GIVEN — Pre-conditions
// ════════════════════════════════════════════════════════════════════

Given('the application is available at the base URL', async function () {
  // World sets up baseURL — just verify the context is ready
  expect(this.page || this.apiContext).toBeTruthy();
});

Given('I navigate to {string}', async function (path) {
  await this.page.goto(path, { waitUntil: 'networkidle' });
});

Given('I wait {int} seconds', async function (seconds) {
  await this.page.waitForTimeout(seconds * 1000);
});

// ════════════════════════════════════════════════════════════════════
// WHEN — Generic Interactions
// ════════════════════════════════════════════════════════════════════

When('I click the {string} button', async function (buttonName) {
  await this.page.getByRole('button', { name: buttonName }).click();
});

When('I click the {string} link', async function (linkName) {
  await this.page.getByRole('link', { name: linkName }).click();
});

When('I fill in {string} with {string}', async function (label, value) {
  await this.page.getByLabel(label).fill(value);
});

When('I fill in the field with test ID {string} with {string}', async function (testId, value) {
  await this.page.getByTestId(testId).fill(value);
});

When('I check the {string} checkbox', async function (label) {
  await this.page.getByRole('checkbox', { name: label }).check();
});

When('I uncheck the {string} checkbox', async function (label) {
  await this.page.getByRole('checkbox', { name: label }).uncheck();
});

When('I select {string} from the {string} dropdown', async function (option, label) {
  await this.page.getByRole('combobox', { name: label }).selectOption({ label: option });
});

When('I press {string} key', async function (key) {
  await this.page.keyboard.press(key);
});

When('I clear the {string} field', async function (label) {
  await this.page.getByLabel(label).clear();
});

When('I scroll to the {string} element', async function (testId) {
  await this.page.getByTestId(testId).scrollIntoViewIfNeeded();
});

// ════════════════════════════════════════════════════════════════════
// THEN — Generic Assertions
// ════════════════════════════════════════════════════════════════════

Then('I should see {string} text on the page', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 10_000 });
});

Then('the page title should be {string}', async function (title) {
  await expect(this.page).toHaveTitle(title);
});

Then('the page URL should contain {string}', async function (urlPart) {
  await expect(this.page).toHaveURL(new RegExp(urlPart));
});

Then('the {string} button should be disabled', async function (buttonName) {
  await expect(this.page.getByRole('button', { name: buttonName })).toBeDisabled();
});

Then('the {string} button should be enabled', async function (buttonName) {
  await expect(this.page.getByRole('button', { name: buttonName })).toBeEnabled();
});

Then('I should see a {string} element', async function (testId) {
  await expect(this.page.getByTestId(testId)).toBeVisible({ timeout: 10_000 });
});

Then('I should not see a {string} element', async function (testId) {
  await expect(this.page.getByTestId(testId)).toBeHidden();
});

Then('the {string} field should have value {string}', async function (label, value) {
  await expect(this.page.getByLabel(label)).toHaveValue(value);
});

Then('a success notification should appear', async function () {
  await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
});

Then('an error notification should appear', async function () {
  await expect(this.page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
});
