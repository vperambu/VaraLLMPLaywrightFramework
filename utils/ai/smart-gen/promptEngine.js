/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/smart-gen/promptEngine.js — Gherkin Prompt Engineering
 *
 * Core Innovation: "Step Inventory First" strategy
 *
 * Pipeline:
 *  1. Scan existing step definition files → build step inventory
 *  2. Include step inventory in the LLM prompt
 *  3. Instruct LLM to maximize reuse (minimize new steps)
 *  4. Track reusability % as a quality metric
 *
 * This prevents "step bloat" — the #1 cause of unmaintainable
 * Cucumber suites where every feature has unique step definitions.
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'fs/promises';
import path from 'path';
import { frameworkConfig } from '../../../config/framework.config.js';

const { llm, smartGen } = frameworkConfig;

// Matches Given/When/Then patterns (regex, string args, docstring args)
const STEP_PATTERN = /(?:Given|When|Then|And|But)\s*\(['"`](.*?)['"`]/g;

/**
 * @typedef {Object} StepInventory
 * @property {string[]} steps      - All existing step definition patterns
 * @property {number}   fileCount  - Number of step definition files scanned
 */

/**
 * @typedef {Object} GenerationResult
 * @property {string}  featureContent  - Generated .feature file content
 * @property {string}  jiraId
 * @property {number}  reusabilityPct  - % of steps from existing inventory
 * @property {string[]} newSteps       - Steps proposed as new
 * @property {string[]} reusedSteps    - Steps matched from inventory
 * @property {number}  durationMs
 */

/**
 * Builds the LLM prompt and generates a Gherkin feature file.
 *
 * @param {import('./jiraParser.js').ParsedStory} story
 * @param {Array<{id: string, metadata: object}>} similarFeatures
 * @returns {Promise<GenerationResult>}
 */
export async function generateGherkin(story, similarFeatures = []) {
  const startTime = Date.now();
  const inventory = await buildStepInventory(smartGen.stepDefsDir);

  const prompt = buildPrompt(story, similarFeatures, inventory);

  let featureContent;
  if (!llm.openaiApiKey || llm.openaiApiKey === 'sk-your-key-here') {
    console.warn('⚠️  No OpenAI key — using template-based generation stub');
    featureContent = _templateGenerate(story, inventory);
  } else {
    featureContent = await _llmGenerate(prompt);
  }

  const analysis = analyzeReusability(featureContent, inventory.steps);

  return {
    featureContent,
    jiraId: story.id,
    reusabilityPct: analysis.reusabilityPct,
    newSteps: analysis.newSteps,
    reusedSteps: analysis.reusedSteps,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Scans the step definitions directory and extracts all step patterns.
 * @param {string} stepsDir
 * @returns {Promise<StepInventory>}
 */
export async function buildStepInventory(stepsDir) {
  const steps = [];
  let fileCount = 0;

  try {
    const entries = await fs.readdir(stepsDir);
    const stepFiles = entries.filter((f) => f.endsWith('.steps.js') || f.endsWith('.steps.ts'));

    for (const file of stepFiles) {
      const content = await fs.readFile(path.join(stepsDir, file), 'utf-8');
      const matches = [...content.matchAll(STEP_PATTERN)];
      matches.forEach((m) => {
        if (m[1]) steps.push(m[1]);
      });
      fileCount++;
    }
  } catch (err) {
    console.warn(`⚠️  Could not scan step defs: ${err.message}`);
  }

  return { steps, fileCount };
}

/**
 * Constructs the full LLM prompt for Gherkin generation.
 * @param {import('./jiraParser.js').ParsedStory} story
 * @param {Array} similarFeatures
 * @param {StepInventory} inventory
 * @returns {string}
 */
export function buildPrompt(story, similarFeatures, inventory) {
  const acList = story.acceptanceCriteria
    .map((ac, i) => `  AC${i + 1}: ${ac}`)
    .join('\n');

  const inventoryText = inventory.steps.length > 0
    ? inventory.steps.map((s) => `  - ${s}`).join('\n')
    : '  (No existing steps found — define new steps as needed)';

  const similarText = similarFeatures.length > 0
    ? similarFeatures
        .map((f) => `  [${f.id}] ${f.metadata?.summary || 'Similar Feature'} (similarity: ${(f.score * 100).toFixed(1)}%)`)
        .join('\n')
    : '  (No similar historical features found)';

  return `You are an expert QA Automation Architect generating strict, production-quality Gherkin feature files.

## YOUR CONSTRAINTS (MANDATORY):
1. **Reuse Existing Steps FIRST**: Before defining any new step, check the EXISTING STEP INVENTORY below. 
   If a matching step exists, use it EXACTLY. This is the #1 priority.
2. **Gherkin Standards**: Use proper Given/When/Then structure. No compound steps (no "and" in the action phrase).
3. **Locator Independence**: Steps must NOT reference CSS selectors or XPath — only user-visible text and roles.
4. **Parameterize**: Use {string} and {int} parameters for reusability.
5. **Tags**: Add Feature tags (@smoke, @regression, etc.) based on story priority.
6. **Examples Tables**: Use Scenario Outline + Examples for data-driven tests.

## EXISTING STEP INVENTORY (USE THESE FIRST):
${inventoryText}

## SIMILAR HISTORICAL FEATURES (for context):
${similarText}

## JIRA STORY TO IMPLEMENT:
**ID**: ${story.id}
**Summary**: ${story.summary}
**Priority**: ${story.priority}
**Labels**: ${story.labels.join(', ')}

**Acceptance Criteria**:
${acList}

## OUTPUT FORMAT:
Generate ONLY the .feature file content. Do not include explanations or markdown fences.
Start with the Feature: line immediately.
For each AC, create at least one Scenario or Scenario Outline.
Add "# NEW STEP" comment above only steps not found in the Existing Step Inventory.
`;
}

/**
 * Calls the OpenAI Chat API to generate Gherkin.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function _llmGenerate(prompt) {
  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: llm.openaiApiKey });

  const response = await client.chat.completions.create({
    model: llm.chatModel,
    temperature: llm.temperature,
    max_tokens: llm.maxTokens,
    messages: [
      {
        role: 'system',
        content:
          'You are a QA automation expert. Generate only valid, executable Gherkin feature file content. No markdown, no explanations.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Template-based fallback when no LLM API key is available.
 * Produces a deterministic feature file from the story's AC.
 * @param {import('./jiraParser.js').ParsedStory} story
 * @param {StepInventory} inventory
 * @returns {string}
 */
function _templateGenerate(story, inventory) {
  const tag = story.featureTag;
  const scenarios = story.acceptanceCriteria
    .map((ac, i) => {
      // Parse "Given ... when ... then ..." from AC text
      const givenMatch = ac.match(/given\s+(.+?),?\s+when/i);
      const whenMatch  = ac.match(/when\s+(.+?),?\s+then/i);
      const thenMatch  = ac.match(/then\s+(.+?)\.?$/i);

      const given = givenMatch ? givenMatch[1] : `the precondition for AC${i + 1} is met`;
      const when  = whenMatch  ? whenMatch[1]  : `the user performs the AC${i + 1} action`;
      const then  = thenMatch  ? thenMatch[1]  : `the AC${i + 1} outcome is verified`;

      return `
  Scenario: AC${i + 1} - ${_truncate(ac, 60)}
    Given ${given}
    When ${when}
    Then ${then}`;
    })
    .join('\n');

  return `${tag}
Feature: ${story.summary}

  As a user
  I want ${story.summary.toLowerCase()}
  So that the acceptance criteria are satisfied
${scenarios}
`;
}

/**
 * Analyzes the generated feature file to calculate reusability %.
 * @param {string} featureContent
 * @param {string[]} existingSteps
 * @returns {{ reusabilityPct: number, newSteps: string[], reusedSteps: string[] }}
 */
export function analyzeReusability(featureContent, existingSteps) {
  const generatedStepPattern = /^\s+(?:Given|When|Then|And)\s+(.+)$/gm;
  const generatedSteps = [];

  let match;
  while ((match = generatedStepPattern.exec(featureContent)) !== null) {
    generatedSteps.push(match[1].trim());
  }

  if (generatedSteps.length === 0) {
    return { reusabilityPct: 0, newSteps: [], reusedSteps: [] };
  }

  const reusedSteps = [];
  const newSteps = [];

  for (const step of generatedSteps) {
    // Normalize: replace quoted strings and numbers with placeholders
    const normalized = step.replace(/"[^"]*"/g, '{string}').replace(/\d+/g, '{int}');
    const isReused = existingSteps.some((existing) => {
      const normExisting = existing.replace(/"[^"]*"/g, '{string}').replace(/\d+/g, '{int}');
      return normExisting === normalized || existing.includes(normalized.substring(0, 30));
    });

    if (isReused) {
      reusedSteps.push(step);
    } else {
      newSteps.push(step);
    }
  }

  const reusabilityPct = Math.round((reusedSteps.length / generatedSteps.length) * 100);

  return { reusabilityPct, newSteps, reusedSteps };
}

function _truncate(str, maxLen) {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}
