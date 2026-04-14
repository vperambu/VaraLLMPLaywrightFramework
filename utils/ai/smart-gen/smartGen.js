/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/smart-gen/smartGen.js — Pipeline Orchestrator (CLI Entry)
 *
 * Usage:
 *   node utils/ai/smart-gen/smartGen.js --jira <path> [--output <dir>]
 *
 * Pipeline Steps:
 *  1. Parse Jira JSON → structured stories
 *  2. Generate embeddings for each story's AC text
 *  3. Query VectorDB for similar historical features
 *  4. Build prompt with step inventory (reuse-first)
 *  5. Call LLM to generate Gherkin feature file
 *  6. Write .feature file to output directory
 *  7. Upsert new feature into VectorDB for future queries
 *  8. Report reusability metrics
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from 'util';

import { parseJiraFile, validateStory } from './jiraParser.js';
import { getEmbedding } from './embeddingService.js';
import { getVectorStore } from './vectorStore.js';
import { generateGherkin } from './promptEngine.js';
import { frameworkConfig } from '../../../config/framework.config.js';

const { smartGen } = frameworkConfig;

// ════════════════════════════════════════════════════════════════════
// CLI Argument Parsing
// ════════════════════════════════════════════════════════════════════
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    jira:   { type: 'string', short: 'j' },
    output: { type: 'string', short: 'o', default: smartGen.outputDir },
    dryRun: { type: 'boolean', short: 'd', default: false },
    verbose:{ type: 'boolean', short: 'v', default: false },
  },
  strict: false,
});

// ════════════════════════════════════════════════════════════════════
// Main Pipeline
// ════════════════════════════════════════════════════════════════════

async function run() {
  const pipelineStart = Date.now();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       🤖 SmartGen RAG Pipeline — Starting        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Validate inputs ─────────────────────────────────────────────
  if (!args.jira) {
    console.error('❌ Usage: node smartGen.js --jira <path-to-jira.json>');
    process.exit(1);
  }

  const jiraPath = path.resolve(args.jira);
  const outputDir = path.resolve(args.output);

  console.log(`📂 Jira Input:  ${jiraPath}`);
  console.log(`📁 Output Dir:  ${outputDir}`);
  console.log(`🔌 VectorDB:    ${frameworkConfig.vectorDb.provider}`);
  console.log(`🤖 LLM Model:   ${frameworkConfig.llm.chatModel}\n`);

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE — no files will be written\n');
  }

  // ── Create output dir ────────────────────────────────────────────
  await fs.mkdir(outputDir, { recursive: true });

  // ── Parse Jira stories ───────────────────────────────────────────
  console.log('Step 1/5: Parsing Jira stories...');
  const stories = await parseJiraFile(jiraPath);
  console.log(`  ✔ Parsed ${stories.length} story(ies)\n`);

  const vectorStore = getVectorStore();
  const metrics = [];

  for (const story of stories) {
    console.log(`─────────────────────────────────────────`);
    console.log(`Processing: [${story.id}] ${story.summary}`);
    console.log(`─────────────────────────────────────────`);

    // ── Validate story ──────────────────────────────────────────
    const { valid, warnings } = validateStory(story);
    warnings.forEach((w) => console.warn(`  ⚠  ${w}`));

    // ── Step 2: Generate embeddings ─────────────────────────────
    console.log('Step 2/5: Generating embeddings for AC text...');
    const embResult = await getEmbedding(story.combinedText);
    if (args.verbose) {
      console.log(`  Model: ${embResult.model}, Tokens: ${embResult.tokenCount}`);
    }
    console.log(`  ✔ Embedding generated (${embResult.embedding.length} dims)\n`);

    // ── Step 3: Query VectorDB ──────────────────────────────────
    console.log('Step 3/5: Querying VectorDB for similar features...');
    const similar = await vectorStore.querySimilar(
      embResult.embedding,
      frameworkConfig.vectorDb.similarityTopK,
    );
    const relevantSimilar = similar.filter((s) => s.score > 0.5);
    console.log(`  ✔ Found ${relevantSimilar.length} similar feature(s) above threshold\n`);

    if (args.verbose && relevantSimilar.length > 0) {
      relevantSimilar.forEach((s) =>
        console.log(`     [${s.id}] score=${(s.score * 100).toFixed(1)}%`),
      );
    }

    // ── Step 4: Generate Gherkin ────────────────────────────────
    console.log('Step 4/5: Generating Gherkin via prompt engine...');
    const result = await generateGherkin(story, relevantSimilar);
    console.log(`  ✔ Feature file generated in ${result.durationMs}ms`);
    console.log(`  📊 Reusability: ${result.reusabilityPct}% of steps reused from inventory`);
    console.log(`  🆕 New steps proposed: ${result.newSteps.length}`);

    if (result.reusabilityPct < smartGen.stepReuseTarget * 100) {
      console.warn(
        `  ⚠  Reusability ${result.reusabilityPct}% below target ${smartGen.stepReuseTarget * 100}%`,
      );
    }
    console.log('');

    // ── Step 5: Write .feature file ─────────────────────────────
    const fileName = `${story.id.toLowerCase().replace(/[-]/g, '_')}.feature`;
    const filePath = path.join(outputDir, fileName);

    if (!args.dryRun) {
      await fs.writeFile(filePath, result.featureContent, 'utf-8');
      console.log(`Step 5/5: Feature written → ${filePath}`);

      // Upsert into VectorDB for future SmartGen calls
      await vectorStore.upsertFeature(story.id, embResult.embedding, {
        summary: story.summary,
        labels: story.labels.join(','),
        priority: story.priority,
        featureFile: fileName,
      });
      console.log('  ✔ Indexed in VectorDB for future similarity queries');
    } else {
      console.log(`Step 5/5: [DRY RUN] Would write → ${filePath}`);
      if (args.verbose) {
        console.log('\n--- GENERATED CONTENT PREVIEW ---');
        console.log(result.featureContent.substring(0, 500) + '...');
        console.log('--- END PREVIEW ---\n');
      }
    }

    metrics.push({
      storyId: story.id,
      summary: story.summary,
      reusabilityPct: result.reusabilityPct,
      newStepCount: result.newSteps.length,
      reusedStepCount: result.reusedSteps.length,
      durationMs: result.durationMs,
      fileName,
    });

    console.log('');
  }

  // ── Summary Report ───────────────────────────────────────────────
  const totalDuration = Date.now() - pipelineStart;
  const avgReusability =
    metrics.reduce((sum, m) => sum + m.reusabilityPct, 0) / (metrics.length || 1);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║              📊 SmartGen Summary                 ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Stories processed:  ${String(metrics.length).padEnd(28)}║`);
  console.log(`║  Average reusability: ${String(avgReusability.toFixed(1) + '%').padEnd(27)}║`);
  console.log(`║  Total pipeline time: ${String(totalDuration + 'ms').padEnd(27)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Write metrics to file
  if (!args.dryRun) {
    const metricsPath = path.join(outputDir, '_smartgen-metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify({ metrics, totalDurationMs: totalDuration }, null, 2), 'utf-8');
    console.log(`📈 Metrics written → ${metricsPath}\n`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ SmartGen pipeline failed:', err);
  process.exit(1);
});
