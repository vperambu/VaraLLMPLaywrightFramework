/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/analytics/riskReporter.js — Risk Report Generator
 *
 * Merges flakiness analysis + failure clustering → risk-report.json
 *
 * Output Schema (risk-report.json):
 * {
 *   "generatedAt": ISO timestamp,
 *   "summary": { flakyCount, highRiskCount, criticalCount, ... },
 *   "flakyScenarios": [ { scenario, flakinessScore, riskLevel, ... } ],
 *   "failureClusters": [ { category, severity, affectedScenarios, ... } ],
 *   "recommendations": [ { priority, action, affectedCount } ],
 *   "metrics": { stepReuseTarget, totalRuns, ... }
 * }
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'fs/promises';
import path from 'path';
import { analyzeFlakiness, computeFlakinessSummary } from './flakinessAnalyzer.js';
import { clusterFailures } from './failureClustering.js';
import { frameworkConfig } from '../../config/framework.config.js';

const { analytics } = frameworkConfig;

// ════════════════════════════════════════════════════════════════════
// Risk Reporter Singleton
// ════════════════════════════════════════════════════════════════════

const riskReporter = {
  /**
   * Runs the full analytics pipeline and writes risk-report.json.
   * @returns {Promise<object>} The generated report object
   */
  async generate() {
    console.log('  📊 Analyzing flakiness scores...');
    const flakinessResults = await analyzeFlakiness();
    const summary = computeFlakinessSummary(flakinessResults);

    // Load raw test results for clustering
    console.log('  🔬 Clustering failure root causes...');
    const rawResults = await _loadRawResults();
    const failureClusters = clusterFailures(rawResults);

    // Generate recommendations
    const recommendations = _generateRecommendations(flakinessResults, failureClusters);

    // Build the report
    const report = {
      generatedAt: new Date().toISOString(),
      frameworkVersion: '1.0.0',
      summary: {
        ...summary,
        totalTestRuns: rawResults.length,
        analysisWindow: _getAnalysisWindow(rawResults),
      },
      flakyScenarios: flakinessResults.filter((r) => r.isFlaky).map((r) => ({
        scenario: r.scenario,
        flakinessScore: r.flakinessScore,
        riskLevel: r.riskLevel,
        totalRuns: r.totalRuns,
        failures: r.failures,
        avgDurationMs: r.avgDurationMs,
        tags: r.tags,
        recentErrors: r.recentErrors,
        suggestedAction: _getSuggestedAction(r),
      })),
      stableScenarios: flakinessResults
        .filter((r) => !r.isFlaky)
        .map((r) => ({
          scenario: r.scenario,
          flakinessScore: r.flakinessScore,
          totalRuns: r.totalRuns,
        })),
      failureClusters: failureClusters.map((cluster) => ({
        category: cluster.category,
        description: cluster.description,
        severity: cluster.severity,
        severityLabel: _severityLabel(cluster.severity),
        affectedScenarioCount: cluster.affectedScenarios.length,
        affectedScenarios: cluster.affectedScenarios,
        sampleErrors: cluster.matchedErrors.slice(0, 3),
        suggestedAction: cluster.suggestedAction,
      })),
      recommendations,
      thresholds: {
        flakinessThreshold: analytics.flakinessThreshold,
        similarityThreshold: analytics.similarityThreshold,
      },
    };

    // Write report
    await fs.mkdir(path.dirname(analytics.riskReportPath), { recursive: true });
    await fs.writeFile(
      analytics.riskReportPath,
      JSON.stringify(report, null, 2),
      'utf-8',
    );

    return report;
  },
};

export default riskReporter;

// ════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ════════════════════════════════════════════════════════════════════

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.substring(process.platform === 'win32' ? 1 : 0))) {
  console.log('🚀 Starting Risk Report Generation...');
  riskReporter.generate()
    .then((report) => {
      console.log('\n✅ Risk Report generated successfully!');
      console.log(`📊 Summary:`);
      console.log(`   - Flaky Scenarios:   ${report.summary.flakyCount}`);
      console.log(`   - High Risk Scenarios: ${report.summary.highRiskCount}`);
      console.log(`   - Total Test Runs:   ${report.summary.totalTestRuns}`);
      console.log(`📂 Path: ${frameworkConfig.analytics.riskReportPath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Analytics pipeline failed:', err);
      process.exit(1);
    });
}

// ════════════════════════════════════════════════════════════════════
// Private Helpers
// ════════════════════════════════════════════════════════════════════

async function _loadRawResults() {
  try {
    const raw = await fs.readFile(analytics.testResultsPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function _generateRecommendations(flakinessResults, clusters) {
  const recs = [];

  // Recommendation 1: Fix critical flaky tests
  const criticalFlaky = flakinessResults.filter((r) => r.riskLevel === 'CRITICAL');
  if (criticalFlaky.length > 0) {
    recs.push({
      priority: 1,
      type: 'IMMEDIATE',
      title: 'Fix Critical Flaky Tests',
      action: `Investigate and fix ${criticalFlaky.length} test(s) with flakiness score ≥70%. These are blocking reliable CI/CD gating.`,
      affectedCount: criticalFlaky.length,
      affectedScenarios: criticalFlaky.map((r) => r.scenario),
    });
  }

  // Recommendation 2: Environment latency cluster
  const envCluster = clusters.find((c) => c.category === 'ENVIRONMENT_LATENCY');
  if (envCluster && envCluster.affectedScenarios.length > 2) {
    recs.push({
      priority: 2,
      type: 'INFRASTRUCTURE',
      title: 'Investigate Environment Latency',
      action: `${envCluster.affectedScenarios.length} test(s) failing due to timeouts. Consider increasing timeout values or optimizing environment startup.`,
      affectedCount: envCluster.affectedScenarios.length,
      affectedScenarios: envCluster.affectedScenarios,
    });
  }

  // Recommendation 3: Element not found
  const elementCluster = clusters.find((c) => c.category === 'ELEMENT_NOT_FOUND');
  if (elementCluster && elementCluster.affectedScenarios.length > 0) {
    recs.push({
      priority: 3,
      type: 'LOCATOR_STRATEGY',
      title: 'Review Locator Resilience',
      action: `${elementCluster.affectedScenarios.length} test(s) failing with "element not found". Run locator-suggester on affected pages to identify stable ARIA-based alternatives.`,
      affectedCount: elementCluster.affectedScenarios.length,
      affectedScenarios: elementCluster.affectedScenarios,
      command: 'npm run locator-suggest -- --url <affected-page-url>',
    });
  }

  // Recommendation 4: Code bugs
  const codeCluster = clusters.find((c) => c.category === 'CODE_BUG');
  if (codeCluster) {
    recs.push({
      priority: 2,
      type: 'CODE_QUALITY',
      title: 'Fix Code Bugs in Tests',
      action: `${codeCluster.affectedScenarios.length} test(s) throwing JavaScript errors (TypeError/ReferenceError). Review null checks and async handling.`,
      affectedCount: codeCluster.affectedScenarios.length,
      affectedScenarios: codeCluster.affectedScenarios,
    });
  }

  // Recommendation 5: General stability
  const highFlakiness = flakinessResults.filter(
    (r) => r.riskLevel === 'HIGH' || r.riskLevel === 'MEDIUM',
  );
  if (highFlakiness.length > 0) {
    recs.push({
      priority: 4,
      type: 'STABILITY',
      title: 'Add @flaky Tag for Automatic Retry',
      action: `Tag ${highFlakiness.length} medium/high risk test(s) with @flaky to enable automatic retry in the regression profile.`,
      affectedCount: highFlakiness.length,
      affectedScenarios: highFlakiness.map((r) => r.scenario).slice(0, 5),
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

function _getSuggestedAction(flakinessResult) {
  const { riskLevel, recentErrors } = flakinessResult;
  const { classifyError } = Object.freeze({
    // Inline classification to avoid circular imports
    classifyError: (err) => {
      if (/timeout/i.test(err)) return 'Increase timeout or add retry (Environment Latency)';
      if (/element.*not found|not visible/i.test(err)) return 'Review locator via locator-suggester tool';
      if (/TypeError|ReferenceError/i.test(err)) return 'Fix null check / code bug in test';
      if (/401|403|unauthorized/i.test(err)) return 'Verify test user credentials and session';
      return 'Investigate manually with playwright trace viewer';
    },
  });

  if (recentErrors.length > 0) {
    return classifyError(recentErrors[0]);
  }

  if (riskLevel === 'CRITICAL') return 'Quarantine test and immediate investigation required';
  if (riskLevel === 'HIGH') return 'Prioritize investigation in next sprint';
  return 'Monitor trend; add @flaky tag for auto-retry';
}

function _getAnalysisWindow(runs) {
  if (runs.length === 0) return null;
  const timestamps = runs.map((r) => r.startTime).filter(Boolean).sort();
  return {
    from: new Date(timestamps[0]).toISOString(),
    to: new Date(timestamps[timestamps.length - 1]).toISOString(),
    runCount: runs.length,
  };
}

function _severityLabel(severity) {
  return ['', 'LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][severity] || 'UNKNOWN';
}
