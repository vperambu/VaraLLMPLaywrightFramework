/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/analytics/flakinessAnalyzer.js — Flakiness Score Calculator
 *
 * Reads test-results.json accumulated by hooks.js After hook.
 * Computes per-scenario flakiness scores and trend analysis.
 *
 * Flakiness Score = Failures / Total Runs (per scenario name)
 * Range: 0.0 (perfect) → 1.0 (always fails)
 * Threshold: 0.20 (configurable in framework.config.js)
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'fs/promises';
import { frameworkConfig } from '../../config/framework.config.js';

const { analytics } = frameworkConfig;

/**
 * @typedef {Object} ScenarioRun
 * @property {string} scenario
 * @property {string} status    - 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING'
 * @property {number} duration
 * @property {string[]} tags
 * @property {string|null} error
 * @property {number} startTime
 */

/**
 * @typedef {Object} FlakinessResult
 * @property {string}   scenario
 * @property {number}   totalRuns
 * @property {number}   failures
 * @property {number}   passes
 * @property {number}   flakinessScore   - 0.0 → 1.0
 * @property {boolean}  isFlaky          - score > threshold
 * @property {string}   riskLevel        - 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 * @property {number}   avgDurationMs
 * @property {string[]} tags
 * @property {string[]} recentErrors     - Last 3 unique error messages
 */

/**
 * Loads test results from JSON file and computes flakiness scores
 * for every unique scenario.
 *
 * @param {string} [filePath] - Override default results path
 * @returns {Promise<FlakinessResult[]>}
 */
export async function analyzeFlakiness(filePath = analytics.testResultsPath) {
  const runs = await _loadTestResults(filePath);

  if (runs.length === 0) {
    console.warn('⚠️  No test run data found. Run tests first to populate test-results.json');
    return [];
  }

  // Group runs by scenario name
  const grouped = _groupByScenario(runs);

  // Calculate scores
  const results = [];
  for (const [scenario, scenarioRuns] of Object.entries(grouped)) {
    const result = _computeFlakinessScore(scenario, scenarioRuns);
    results.push(result);
  }

  // Sort by flakiness score descending (worst first)
  return results.sort((a, b) => b.flakinessScore - a.flakinessScore);
}

/**
 * Returns only the scenarios flagged as flaky (above threshold).
 * @param {string} [filePath]
 * @returns {Promise<FlakinessResult[]>}
 */
export async function getFlakyScenarios(filePath = analytics.testResultsPath) {
  const all = await analyzeFlakiness(filePath);
  return all.filter((r) => r.isFlaky);
}

/**
 * Returns a summary stats object across all scenarios.
 * @param {FlakinessResult[]} results
 */
export function computeFlakinessSummary(results) {
  const total = results.length;
  const flaky = results.filter((r) => r.isFlaky).length;
  const critical = results.filter((r) => r.riskLevel === 'CRITICAL').length;
  const high = results.filter((r) => r.riskLevel === 'HIGH').length;

  const avgScore =
    total > 0
      ? results.reduce((sum, r) => sum + r.flakinessScore, 0) / total
      : 0;

  return {
    totalScenarios: total,
    flakyCount: flaky,
    criticalCount: critical,
    highRiskCount: high + critical,
    averageFlakinessScore: parseFloat(avgScore.toFixed(4)),
    threshold: analytics.flakinessThreshold,
  };
}

// ════════════════════════════════════════════════════════════════════
// Private Helpers
// ════════════════════════════════════════════════════════════════════

async function _loadTestResults(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read test results from ${filePath}: ${err.message}`);
  }
}

function _groupByScenario(runs) {
  return runs.reduce((acc, run) => {
    if (!run.scenario) return acc;
    const key = run.scenario;
    if (!acc[key]) acc[key] = [];
    acc[key].push(run);
    return acc;
  }, {});
}

function _computeFlakinessScore(scenario, runs) {
  const totalRuns = runs.length;
  const failures = runs.filter((r) => r.status === 'FAILED').length;
  const passes = runs.filter((r) => r.status === 'PASSED').length;
  const flakinessScore = parseFloat((failures / totalRuns).toFixed(4));
  const isFlaky = flakinessScore > analytics.flakinessThreshold;

  const avgDurationMs = Math.round(
    runs.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRuns,
  );

  // Get unique error messages from most recent failures
  const recentErrors = [
    ...new Set(
      runs
        .filter((r) => r.error)
        .slice(-5)
        .map((r) => r.error),
    ),
  ].slice(0, 3);

  // Tags from the most recent run
  const tags = runs[runs.length - 1]?.tags || [];

  // Risk level classification
  let riskLevel;
  if (flakinessScore >= 0.7) {
    riskLevel = 'CRITICAL';
  } else if (flakinessScore >= 0.4) {
    riskLevel = 'HIGH';
  } else if (flakinessScore >= analytics.flakinessThreshold) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    scenario,
    totalRuns,
    failures,
    passes,
    flakinessScore,
    isFlaky,
    riskLevel,
    avgDurationMs,
    tags,
    recentErrors,
  };
}
