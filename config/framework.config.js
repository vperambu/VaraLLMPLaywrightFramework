/**
 * ═══════════════════════════════════════════════════════════════
 * varaTestAiFramework — Central Configuration Hub
 * Single source of truth for all framework-wide settings.
 * Override any value via environment variables in .env
 * ═══════════════════════════════════════════════════════════════
 */
import 'dotenv/config';

export const frameworkConfig = {
  // ── Application Under Test ────────────────────────────────────
  app: {
    baseUrl: process.env.BASE_URL || 'https://demo.playwright.dev',
    apiBaseUrl: process.env.API_BASE_URL || 'https://reqres.in/api',
  },

  // ── Playwright Settings ───────────────────────────────────────
  playwright: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: Number(process.env.SLOW_MO) || 0,
    defaultTimeout: Number(process.env.DEFAULT_TIMEOUT) || 30_000,
    navigationTimeout: 60_000,
    retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 2,
    viewport: { width: 1280, height: 720 },
    // Tracing / recording
    tracing: {
      screenshots: true,
      snapshots: true,
      sources: true,
    },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // ── AI / LLM Settings ─────────────────────────────────────────
  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.2,   // Low temp → deterministic Gherkin output
  },

  // ── Vector Database ───────────────────────────────────────────
  vectorDb: {
    provider: process.env.VECTOR_DB_PROVIDER || 'memory', // chroma | pinecone | memory
    chroma: {
      host: process.env.CHROMA_HOST || 'localhost',
      port: Number(process.env.CHROMA_PORT) || 8000,
      collection: process.env.CHROMA_COLLECTION || 'test_features',
    },
    pinecone: {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
      index: process.env.PINECONE_INDEX || 'test-features',
    },
    similarityTopK: Number(process.env.MAX_SIMILAR_FEATURES) || 5,
  },

  // ── SmartGen Pipeline ─────────────────────────────────────────
  smartGen: {
    stepReuseTarget: Number(process.env.STEP_REUSE_TARGET) || 0.80,
    outputDir: './features/generated',
    stepDefsDir: './steps',
    jiraDataDir: './data/jira',
  },

  // ── Predictive Analytics ──────────────────────────────────────
  analytics: {
    flakinessThreshold: Number(process.env.FLAKINESS_THRESHOLD) || 0.20,
    testResultsPath: './data/test-results/test-results.json',
    systemLogsPath: './data/test-results/system-logs.log',
    riskReportPath: './reports/risk-report.json',
    similarityThreshold: 0.75, // for failure clustering
  },

  // ── Reporting ─────────────────────────────────────────────────
  reporting: {
    cucumberJsonPath: './reports/cucumber-report.json',
    htmlReportPath: './reports/cucumber-report.html',
    tracesDir: './playwright-traces',
    videosDir: './playwright-videos',
    screenshotsDir: './playwright-screenshots',
  },

  // ── Locator Strategy Priority ─────────────────────────────────
  locatorStrategy: {
    priority: ['getByRole', 'getByTestId', 'getByLabel', 'getByPlaceholder', 'getByText', 'css'],
    warnOnCssUse: true,
    blockXpathUse: true,
  },
};

export default frameworkConfig;
