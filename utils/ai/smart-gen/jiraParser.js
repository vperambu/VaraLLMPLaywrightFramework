/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/smart-gen/jiraParser.js — Jira Story Parser
 *
 * Reads mock Jira JSON and extracts structured data for the
 * embedding pipeline. Supports both single story and batch modes.
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'fs/promises';

/**
 * @typedef {Object} JiraStory
 * @property {string} id
 * @property {string} summary
 * @property {string[]} acceptance_criteria
 * @property {string[]} labels
 * @property {string} priority
 */

/**
 * @typedef {Object} ParsedStory
 * @property {string} id
 * @property {string} summary
 * @property {string[]} acceptanceCriteria
 * @property {string[]} labels
 * @property {string} priority
 * @property {string} combinedText  - AC joined for embedding
 * @property {string} featureTag    - Derived from labels
 */

/**
 * Parses a Jira JSON file and returns an array of structured story objects.
 * @param {string} filePath - Absolute or relative path to JSON file
 * @returns {Promise<ParsedStory[]>}
 */
export async function parseJiraFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const stories = JSON.parse(raw);

  const normalized = Array.isArray(stories) ? stories : [stories];
  return normalized.map(parseStory);
}

/**
 * Parses a single Jira story object.
 * @param {JiraStory} story
 * @returns {ParsedStory}
 */
export function parseStory(story) {
  if (!story.id || !story.summary) {
    throw new Error(`Invalid Jira story: missing 'id' or 'summary'. Got: ${JSON.stringify(story)}`);
  }

  const acceptanceCriteria = story.acceptance_criteria || story.acceptanceCriteria || [];
  const labels = (story.labels || []).map((l) => l.toLowerCase());

  // Build combined text for embedding (summary + all AC statements)
  const combinedText = [
    `Story: ${story.summary}`,
    ...acceptanceCriteria.map((ac, i) => `AC${i + 1}: ${ac}`),
  ].join('\n');

  // Derive feature tag from labels (first match wins)
  const tagMap = {
    auth: '@auth',
    security: '@security',
    api: '@api',
    ui: '@ui',
    dashboard: '@dashboard',
    users: '@users',
  };

  const featureTag =
    labels.reduce((tag, label) => tag || tagMap[label] || null, null) || '@regression';

  return {
    id: story.id,
    summary: story.summary,
    acceptanceCriteria,
    labels,
    priority: (story.priority || 'Medium').toLowerCase(),
    epicName: story.epic || 'Unassigned',
    sprint: story.sprint || 'Unscheduled',
    combinedText,
    featureTag,
  };
}

/**
 * Validates that a story has at least one acceptance criterion.
 * @param {ParsedStory} story
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateStory(story) {
  const warnings = [];

  if (story.acceptanceCriteria.length === 0) {
    warnings.push(`Story ${story.id}: No acceptance criteria found. SmartGen output may be generic.`);
  }

  if (story.priority === 'critical' && story.labels.length === 0) {
    warnings.push(`Story ${story.id}: Critical priority story has no labels — tagging may be inaccurate.`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
