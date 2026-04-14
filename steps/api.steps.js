/**
 * ═══════════════════════════════════════════════════════════════════
 * steps/api.steps.js — REST API Step Definitions
 *
 * Uses playwright.request (this.apiContext) — no browser instance needed.
 * Supports GET, POST, PUT, PATCH, DELETE with JSON body.
 * Response state is stored in this.state for chained assertions.
 * ═══════════════════════════════════════════════════════════════════
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// GIVEN
// ════════════════════════════════════════════════════════════════════

Given('the API base URL is configured', function () {
  // Verified at framework level in world.js — openApiContext() is called in Before hook
  expect(this.apiContext).not.toBeNull();
});

// ════════════════════════════════════════════════════════════════════
// WHEN — HTTP Methods
// ════════════════════════════════════════════════════════════════════

When('I send a GET request to {string}', async function (endpoint) {
  const response = await this.apiContext.get(endpoint);
  this.set('response', response);
  this.set('responseBody', await response.json().catch(() => null));
});

When('I send a POST request to {string} with body:', async function (endpoint, docString) {
  const body = JSON.parse(docString);
  const response = await this.apiContext.post(endpoint, { data: body });
  this.set('response', response);
  this.set('responseBody', await response.json().catch(() => null));
});

When('I send a PUT request to {string} with body:', async function (endpoint, docString) {
  const body = JSON.parse(docString);
  const response = await this.apiContext.put(endpoint, { data: body });
  this.set('response', response);
  this.set('responseBody', await response.json().catch(() => null));
});

When('I send a PATCH request to {string} with body:', async function (endpoint, docString) {
  const body = JSON.parse(docString);
  const response = await this.apiContext.patch(endpoint, { data: body });
  this.set('response', response);
  this.set('responseBody', await response.json().catch(() => null));
});

When('I send a DELETE request to {string}', async function (endpoint) {
  const response = await this.apiContext.delete(endpoint);
  this.set('response', response);
  // DELETE may return empty body
  this.set('responseBody', null);
});

// ════════════════════════════════════════════════════════════════════
// THEN — Response Assertions
// ════════════════════════════════════════════════════════════════════

Then('the response status code should be {int}', async function (expectedStatus) {
  const response = this.get('response');
  const actualStatus = response.status();
  expect(actualStatus, `Expected ${expectedStatus} but got ${actualStatus}`).toBe(expectedStatus);
});

Then('the response body should contain field {string}', async function (fieldPath) {
  const body = this.get('responseBody');
  const value = _getNestedValue(body, fieldPath);
  expect(value, `Field "${fieldPath}" not found in response body`).toBeDefined();
});

Then('the response body {string} should equal {string}', async function (fieldPath, expectedValue) {
  const body = this.get('responseBody');
  const actual = _getNestedValue(body, fieldPath);
  // Compare as strings since JSON values may be numbers
  expect(String(actual)).toBe(String(expectedValue));
});

Then('the response body {string} should equal {int}', async function (fieldPath, expectedValue) {
  const body = this.get('responseBody');
  const actual = _getNestedValue(body, fieldPath);
  expect(Number(actual)).toBe(expectedValue);
});

Then('the response Content-Type should be {string}', async function (contentType) {
  const response = this.get('response');
  const headers = response.headers();
  expect(headers['content-type']).toContain(contentType);
});

Then('I store the response field {string} as {string}', async function (fieldPath, alias) {
  const body = this.get('responseBody');
  const value = _getNestedValue(body, fieldPath);
  this.set(alias, value);
  console.log(`📦 Stored "${alias}" = ${value}`);
});

// ════════════════════════════════════════════════════════════════════
// Private Helpers
// ════════════════════════════════════════════════════════════════════

/**
 * Safely resolves a dot-notation path in a nested JSON object.
 * Example: getNestedValue({ data: { id: 2 } }, 'data.id') → 2
 * @param {object} obj
 * @param {string} path
 * @returns {any}
 */
function _getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}
