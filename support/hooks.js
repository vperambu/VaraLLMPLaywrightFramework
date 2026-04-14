/**
 * ═══════════════════════════════════════════════════════════════════
 * support/hooks.js — Global Cucumber Lifecycle Hooks
 *
 * Lifecycle:
 *  BeforeAll  → Ensure reporting directories exist
 *  Before     → Initialize browser/API context, set scenario metadata
 *  After      → Capture artifacts on failure, ingest logs to AI buffer
 *  AfterAll   → Run flakiness analysis, generate risk-report.json
 * ═══════════════════════════════════════════════════════════════════
 */
import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import fs from 'fs/promises';
import path from 'path';
import { frameworkConfig } from '../config/framework.config.js';

// ── Lazy import of analytics (avoid startup cost for API-only runs) ──
let riskReporter = null;
const loadRiskReporter = async () => {
  if (!riskReporter) {
    const mod = await import('../utils/analytics/riskReporter.js');
    riskReporter = mod.default;
  }
  return riskReporter;
};

// ════════════════════════════════════════════════════════════════════
// BEFORE ALL — Framework Bootstrap
// ════════════════════════════════════════════════════════════════════
BeforeAll(async function () {
  const dirs = [
    frameworkConfig.reporting.tracesDir,
    frameworkConfig.reporting.videosDir,
    frameworkConfig.reporting.screenshotsDir,
    path.dirname(frameworkConfig.reporting.cucumberJsonPath),
    path.dirname(frameworkConfig.analytics.riskReportPath),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('\n🤖 AI-Augmented Playwright Framework Initialized');
  console.log(`📁 Reports → ${path.resolve('./reports')}`);
  console.log(`🔬 Vector DB Provider: ${frameworkConfig.vectorDb.provider}\n`);
});

// ════════════════════════════════════════════════════════════════════
// BEFORE — Per-Scenario Setup
// ════════════════════════════════════════════════════════════════════
Before(async function (scenario) {
  const { pickle, gherkinDocument } = scenario;

  this.scenarioName = pickle.name;
  this.scenarioTags = pickle.tags.map((t) => t.name);
  this.startTime = Date.now();

  // ── Initialize AI log buffer ─────────────────────────────────
  this.aiLog = {
    scenario: this.scenarioName,
    tags: this.scenarioTags,
    steps: [],
    consoleErrors: [],
    networkFailures: [],
    startTime: this.startTime,
    endTime: null,
  };

  // ── Browser initialization (skip for @api-only scenarios) ────
  const isApiOnly = this.scenarioTags.includes('@api') && !this.scenarioTags.includes('@ui');

  if (!isApiOnly) {
    await this.openBrowser();
  }

  // ── API context (always available) ───────────────────────────
  await this.openApiContext();

  console.log(`\n▶ Starting: "${this.scenarioName}" [${this.scenarioTags.join(', ')}]`);
});

// ════════════════════════════════════════════════════════════════════
// AFTER — Per-Scenario Teardown
// ════════════════════════════════════════════════════════════════════
After(async function (scenario) {
  const endTime = Date.now();
  const duration = endTime - this.startTime;
  const status = scenario.result?.status;
  const failed = status === Status.FAILED;

  // ── Capture artifacts on failure ──────────────────────────────
  if (failed && this.page && !this.page.isClosed()) {
    // Screenshot
    const screenshotBuffer = await this.page.screenshot({ fullPage: true });
    await this.attach(screenshotBuffer, 'image/png');

    // Page HTML snapshot
    const html = await this.page.content();
    await this.attach(html, 'text/html');

    // AI Log — console errors and network failures
    if (this.aiLog.consoleErrors.length > 0) {
      await this.attach(
        JSON.stringify(this.aiLog.consoleErrors, null, 2),
        'application/json',
      );
    }
  }

  // ── Finalize AI log ───────────────────────────────────────────
  this.aiLog.endTime = endTime;
  this.aiLog.duration = duration;
  this.aiLog.status = status;
  this.aiLog.error = scenario.result?.message || null;

  // ── Persist AI log for analytics pipeline ─────────────────────
  await _appendToTestResults(this.aiLog);

  // ── Close browser / API context ───────────────────────────────
  await this.closeBrowser();

  const icon = failed ? '❌' : '✅';
  console.log(`${icon} Completed: "${this.scenarioName}" in ${duration}ms`);
});

// ════════════════════════════════════════════════════════════════════
// AFTER ALL — Analytics & Reporting
// ════════════════════════════════════════════════════════════════════
AfterAll(async function () {
  console.log('\n🔬 Running AI Predictive Analytics...');
  try {
    const reporter = await loadRiskReporter();
    const report = await reporter.generate();
    console.log(`📊 Risk Report written → ${frameworkConfig.analytics.riskReportPath}`);
    console.log(`   High-risk tests: ${report.summary.highRiskCount}`);
    console.log(`   Flaky tests detected: ${report.summary.flakyCount}`);
  } catch (err) {
    console.warn('⚠️  Could not generate risk report:', err.message);
  }
  console.log('\n✔ Framework teardown complete.\n');
});

// ════════════════════════════════════════════════════════════════════
// Private Helpers
// ════════════════════════════════════════════════════════════════════

/**
 * Appends a single scenario's AI log to the aggregate test-results.json.
 * Uses a rolling append strategy to avoid reading large files on every run.
 */
async function _appendToTestResults(logEntry) {
  const filePath = frameworkConfig.analytics.testResultsPath;

  let existing = [];
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // File doesn't exist yet — start fresh
  }

  existing.push(logEntry);

  // Keep last 1000 entries to prevent unbounded growth
  if (existing.length > 1000) {
    existing = existing.slice(-1000);
  }

  await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
}
