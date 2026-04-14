/**
 * ═══════════════════════════════════════════════════════════════════
 * cucumber.js — varaTestAiFramework Multi-Profile Runner
 *
 * Profiles:
 *   default    → All tests (UI + API)
 *   smoke      → @smoke tagged tests only
 *   regression → Full regression suite with retries
 *   api        → API-only tests
 *   generated  → AI-generated feature files
 * ═══════════════════════════════════════════════════════════════════
 */

/** @type {import('@cucumber/cucumber').IConfiguration} */
const common = {
  require: [
    'support/world.js',
    'support/hooks.js',
    'steps/**/*.steps.js',
  ],
  requireModule: [],
  format: [
    'progress-bar',
    `json:reports/cucumber-report.json`,
    `html:reports/cucumber-report.html`,
  ],
  formatOptions: {
    snippetInterface: 'async-await',
  },
  publishQuiet: true,
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature'],
    parallel: 2,
  },
  smoke: {
    ...common,
    paths: ['features/**/*.feature'],
    tags: '@smoke',
    parallel: 1,
  },
  regression: {
    ...common,
    paths: ['features/**/*.feature'],
    retry: 2,
    retryTagFilter: '@flaky',
    parallel: 4,
  },
  api: {
    ...common,
    paths: ['features/api/**/*.feature'],
    tags: '@api',
    parallel: 2,
  },
  generated: {
    ...common,
    paths: ['features/generated/**/*.feature'],
    parallel: 1,
  },
};
