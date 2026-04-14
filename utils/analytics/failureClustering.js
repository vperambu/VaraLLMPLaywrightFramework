/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/analytics/failureClustering.js — ML Failure Root Cause Clustering
 *
 * Groups failure error messages into semantic clusters using
 * string similarity (Jaro-Winkler approximation via string-similarity).
 *
 * Cluster Categories:
 *   ENVIRONMENT_LATENCY  → Timeouts, slow networks, flaky selectors
 *   ELEMENT_NOT_FOUND    → Missing DOM elements, wrong selectors
 *   ASSERTION_FAILURE    → Expected vs actual value mismatches
 *   NETWORK_ERROR        → HTTP failures, CORS, 4xx/5xx responses
 *   CODE_BUG             → TypeError, ReferenceError, null deref
 *   AUTHENTICATION       → Login/session failures
 *   DATA_ERROR           → Invalid test data, missing fixtures
 *   UNKNOWN              → Unclassified errors
 * ═══════════════════════════════════════════════════════════════════
 */
import stringSimilarity from 'string-similarity';

/**
 * @typedef {Object} FailureCluster
 * @property {string}   category       - Root cause category
 * @property {string}   description    - Human-readable cause description
 * @property {string}   suggestedAction
 * @property {string[]} matchedErrors  - Error messages in this cluster
 * @property {string[]} affectedScenarios
 * @property {number}   severity       - 1(low) → 5(critical)
 */

// ════════════════════════════════════════════════════════════════════
// Signature-based Error Classification Rules
// Each rule has a pattern (regex or keyword array) and a category.
// ════════════════════════════════════════════════════════════════════

const CLASSIFICATION_RULES = [
  {
    category: 'ENVIRONMENT_LATENCY',
    description: 'Timeout or slow environment response causing test flakiness',
    suggestedAction: 'Increase timeout values, add retry logic, investigate environment performance',
    severity: 3,
    patterns: [
      /timeout/i,
      /timed out/i,
      /exceeded.*timeout/i,
      /waitfor.*exceeded/i,
      /navigation timeout/i,
      /slow network/i,
    ],
  },
  {
    category: 'ELEMENT_NOT_FOUND',
    description: 'Target DOM element not present or not visible when expected',
    suggestedAction:
      'Review selector stability, add explicit waits, check if element conditionally renders',
    severity: 3,
    patterns: [
      /element.*not found/i,
      /locator.*resolved to/i,
      /no element.*matches/i,
      /strict mode violation/i,
      /getByRole.*not visible/i,
      /waiting for.*visible/i,
      /element is not visible/i,
    ],
  },
  {
    category: 'ASSERTION_FAILURE',
    description: 'Test assertion failed — actual result does not match expected',
    suggestedAction: 'Review assertion logic, verify test data is deterministic, check for async timing issues',
    severity: 2,
    patterns: [
      /expect\(.*\).to/i,
      /expected.*received/i,
      /assertion.*failed/i,
      /to.*equal.*but.*received/i,
      /toBeVisible.*failed/i,
      /toHaveText.*failed/i,
      /toHaveURL.*failed/i,
    ],
  },
  {
    category: 'NETWORK_ERROR',
    description: 'HTTP request failed or returned an error status code',
    suggestedAction: 'Check API availability, verify test environment network config, review mock data',
    severity: 4,
    patterns: [
      /net::/i,
      /ERR_/i,
      /failed fetch/i,
      /network request failed/i,
      /status.*4\d\d/i,
      /status.*5\d\d/i,
      /cors/i,
      /connection refused/i,
    ],
  },
  {
    category: 'CODE_BUG',
    description: 'JavaScript error in test code or application code',
    suggestedAction: 'Review test code for null checks, fix TypeError/ReferenceError in test or app code',
    severity: 5,
    patterns: [
      /TypeError/i,
      /ReferenceError/i,
      /cannot read prop/i,
      /is not a function/i,
      /undefined.*property/i,
      /null.*cannot/i,
      /SyntaxError/i,
    ],
  },
  {
    category: 'AUTHENTICATION',
    description: 'Login or session management failure',
    suggestedAction: 'Verify test user credentials, check session cookie handling, review auth token expiry',
    severity: 4,
    patterns: [
      /401/i,
      /403/i,
      /unauthorized/i,
      /forbidden/i,
      /login.*failed/i,
      /session.*expired/i,
      /authentication/i,
    ],
  },
  {
    category: 'DATA_ERROR',
    description: 'Test data is invalid, stale, or missing',
    suggestedAction: 'Verify test fixtures, reset database state between runs, use factory methods for test data',
    severity: 3,
    patterns: [
      /test data/i,
      /fixture/i,
      /not found in.*database/i,
      /invalid.*payload/i,
      /missing.*field/i,
      /schema.*validation/i,
    ],
  },
];

/**
 * Classifies a single error message into a category.
 * @param {string} errorMessage
 * @returns {typeof CLASSIFICATION_RULES[0] | null}
 */
export function classifyError(errorMessage) {
  if (!errorMessage) return null;

  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(errorMessage)) {
        return rule;
      }
    }
  }

  return {
    category: 'UNKNOWN',
    description: 'Error could not be automatically classified',
    suggestedAction: 'Manual investigation required — review stack trace and logs',
    severity: 2,
    patterns: [],
  };
}

/**
 * Clusters an array of failure entries by root cause.
 *
 * @param {Array<{scenario: string, error: string, status: string}>} failures
 * @returns {FailureCluster[]}
 */
export function clusterFailures(failures) {
  const activeFail = failures.filter((f) => f.status === 'FAILED' && f.error);

  /** @type {Map<string, FailureCluster>} */
  const clusterMap = new Map();

  for (const fail of activeFail) {
    const classification = classifyError(fail.error);
    const category = classification?.category || 'UNKNOWN';

    if (!clusterMap.has(category)) {
      clusterMap.set(category, {
        category,
        description: classification?.description || 'Unknown error type',
        suggestedAction: classification?.suggestedAction || 'Investigate manually',
        severity: classification?.severity || 1,
        matchedErrors: [],
        affectedScenarios: [],
      });
    }

    const cluster = clusterMap.get(category);

    // Add unique errors (using similarity to avoid near-duplicates)
    const isDuplicate = cluster.matchedErrors.some(
      (existing) =>
        stringSimilarity.compareTwoStrings(existing, fail.error) >
        frameworkConfigThreshold(),
    );

    if (!isDuplicate) {
      cluster.matchedErrors.push(fail.error.substring(0, 200));
    }

    if (!cluster.affectedScenarios.includes(fail.scenario)) {
      cluster.affectedScenarios.push(fail.scenario);
    }
  }

  // Sort clusters by severity (highest first)
  return Array.from(clusterMap.values()).sort((a, b) => b.severity - a.severity);
}

/**
 * Groups similar error messages together using string similarity.
 * Returns groups of error messages that are >75% similar.
 * @param {string[]} errorMessages
 * @returns {Array<string[]>}
 */
export function groupSimilarErrors(errorMessages) {
  if (errorMessages.length === 0) return [];

  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < errorMessages.length; i++) {
    if (assigned.has(i)) continue;

    const group = [errorMessages[i]];
    assigned.add(i);

    for (let j = i + 1; j < errorMessages.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = stringSimilarity.compareTwoStrings(
        errorMessages[i],
        errorMessages[j],
      );

      if (similarity >= 0.75) {
        group.push(errorMessages[j]);
        assigned.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

function frameworkConfigThreshold() {
  // Avoid circular import — use a constant
  return 0.75;
}
