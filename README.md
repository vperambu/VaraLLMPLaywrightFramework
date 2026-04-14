# 🤖 varaTestAiFramework

> **AI-Augmented Test Automation Framework** — Playwright + Cucumber with RAG-Powered Test Generation & ML Failure Prediction

[![Playwright](https://img.shields.io/badge/Playwright-1.43+-green?logo=playwright)](https://playwright.dev)
[![Cucumber](https://img.shields.io/badge/Cucumber-BDD-brightgreen?logo=cucumber)](https://cucumber.io)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai)](https://openai.com)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    varaTestAiFramework                           │
├─────────────────┬───────────────────┬───────────────────────────┤
│  SmartGen (RAG) │  Playwright+BDD   │  Predictive Analytics     │
│  ┌───────────┐  │  ┌─────────────┐  │  ┌─────────────────────┐  │
│  │ Jira JSON │  │  │ Feature     │  │  │ test-results.json   │  │
│  │     ↓     │  │  │ Files (.gh) │  │  │       ↓             │  │
│  │Embeddings │  │  │     ↓       │  │  │ Flakiness Analyzer  │  │
│  │     ↓     │  │  │ Step Defs   │  │  │       ↓             │  │
│  │ VectorDB  │  │  │     ↓       │  │  │ Failure Clustering  │  │
│  │     ↓     │  │  │ Page Objects│  │  │       ↓             │  │
│  │ LLM Prompt│  │  │     ↓       │  │  │ risk-report.json    │  │
│  │     ↓     │  │  │ Playwright  │  │  │                     │  │
│  │ .feature  │  │  │ Execution   │  │  │ Recommendations     │  │
│  └───────────┘  │  └─────────────┘  │  └─────────────────────┘  │
└─────────────────┴───────────────────┴───────────────────────────┘
```

## 📁 Project Structure

```
varaTestAiFramework/
├── features/                     # Gherkin feature files
│   ├── auth/login.feature        # UI login BDD scenarios
│   ├── api/users-crud.feature    # REST API CRUD scenarios
│   └── generated/                # AI-generated features (SmartGen output)
├── pages/                        # Page Object Model (POM)
│   ├── BasePage.js               # Shared utilities, locator wrappers
│   ├── LoginPage.js              # Login page (ARIA-first locators)
│   └── DashboardPage.js          # Dashboard page
├── steps/                        # Cucumber step definitions
│   ├── auth.steps.js             # UI auth steps
│   ├── api.steps.js              # REST API steps
│   └── shared.steps.js           # Reusable shared steps
├── support/                      # Cucumber infrastructure
│   ├── world.js                  # Custom World (DI container)
│   └── hooks.js                  # Lifecycle hooks (tracing, video, AI logs)
├── utils/
│   ├── ai/
│   │   ├── smart-gen/            # 🤖 RAG-based test generation pipeline
│   │   │   ├── smartGen.js       # CLI orchestrator
│   │   │   ├── jiraParser.js     # Jira JSON → structured stories
│   │   │   ├── embeddingService.js # Text → vector embeddings
│   │   │   ├── vectorStore.js    # ChromaDB / Pinecone / Memory
│   │   │   └── promptEngine.js   # Step-inventory-first Gherkin prompts
│   │   └── locator/              # 🎯 Autonomous locator engine
│   │       ├── domParser.js      # WAI-ARIA tree parser
│   │       └── locatorSuggester.js # Ranked locator suggestions + POM gen
│   └── analytics/                # 📊 ML predictive analytics
│       ├── flakinessAnalyzer.js  # Per-scenario flakiness scores
│       ├── failureClustering.js  # Root cause clustering
│       └── riskReporter.js       # Unified risk-report.json generator
├── data/
│   ├── jira/sample-stories.json  # Mock Jira story data
│   ├── vector_store/             # Vector DB persistence (local)
│   └── test-results/             # Historical test run data
├── reports/                      # Generated reports
├── config/framework.config.js    # Central configuration hub
├── cucumber.js                   # Cucumber profiles
├── playwright.config.js          # Playwright multi-browser config
└── package.json
```

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/vpera/varaTestAiFramework.git
cd varaTestAiFramework
npm install
npx playwright install

# 2. Configure environment
cp .env.example .env
# Edit .env with your OpenAI key and target URLs

# 3. Run tests
npm test                    # All tests
npm run test:smoke          # Smoke tests only
npm run test:api            # API tests only
npm run test:dry            # Dry run (validate bindings)

# 4. AI-powered test generation
npm run smart-gen -- --jira data/jira/sample-stories.json
npm run smart-gen:dry -- --jira data/jira/sample-stories.json  # Preview mode

# 5. Autonomous locator discovery
npm run locator-suggest -- --url https://your-app.com/login

# 6. Generate risk report
npm run risk-report
```

## 🤖 Module Details

### A. SmartGen Pipeline (RAG-Based Test Generation)

Converts Jira stories → executable Gherkin feature files using:

1. **Jira Parser** — Extracts acceptance criteria from JSON
2. **Embedding Service** — Converts AC text → OpenAI embeddings (with stub fallback)
3. **Vector Store** — Queries ChromaDB/Pinecone for similar historical features
4. **Prompt Engine** — Builds reuse-first LLM prompts using existing step inventory
5. **Output** — Writes `.feature` files + tracks reusability metrics

**Key Innovation**: Step Inventory First — the LLM is instructed to maximize reuse of existing step definitions before proposing new ones, preventing "step bloat."

### B. Autonomous Locator Strategy

- Parses live DOM using `page.accessibility.snapshot()` (WAI-ARIA tree)
- Ranks locators: `getByRole` > `getByTestId` > `getByLabel` > `getByText` > CSS
- Generates ready-to-paste Page Object Model code
- **Zero CSS/XPath dependency** in all framework-provided POMs

### C. Predictive Analytics Engine

- **Flakiness Analyzer**: `flakinessScore = failures / totalRuns` per scenario
- **Failure Clustering**: Groups errors by root cause (Environment Latency, Element Not Found, Code Bug, etc.)
- **Risk Reporter**: Merges both into `risk-report.json` with prioritized recommendations

## 📊 Success Metrics

| Metric | Mechanism | Target |
|---|---|---|
| **Step Reusability** | `promptEngine.js` logs existing vs new steps | ≥80% |
| **Locator Stability** | 0 CSS/XPath in generated POMs | 100% ARIA |
| **Generation Speed** | `smartGen.js` pipeline duration | <5s per story |
| **Flakiness Detection** | `risk-report.json` threshold | Flag at >20% |

## 🔧 Configuration

All settings are centralized in `config/framework.config.js` and overridable via `.env`:

- **App URLs**: `BASE_URL`, `API_BASE_URL`
- **LLM**: `OPENAI_API_KEY`, model selection, temperature
- **Vector DB**: Provider selection (chroma/pinecone/memory)
- **Analytics**: Flakiness thresholds, similarity thresholds
- **Playwright**: Headless mode, timeouts, viewport, tracing

## 📝 License

MIT © Vara Pera
