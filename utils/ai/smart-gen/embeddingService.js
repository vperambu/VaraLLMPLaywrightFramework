/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/smart-gen/embeddingService.js — Embedding Service
 *
 * Converts text → vector embeddings using:
 *  Primary:  OpenAI text-embedding-3-small
 *  Fallback: LangChain OpenAIEmbeddings wrapper
 *  Stub:     In-memory deterministic hash (no API key needed for testing)
 *
 * Each embedding is 1536-dimensional (OpenAI default).
 * ═══════════════════════════════════════════════════════════════════
 */
import { frameworkConfig } from '../../../config/framework.config.js';

const { llm } = frameworkConfig;

/**
 * @typedef {Object} EmbeddingResult
 * @property {number[]} embedding   - Vector representation
 * @property {string}   model       - Model used
 * @property {number}   tokenCount  - Approximate token usage
 */

/** Singleton OpenAI client (lazy initialized) */
let openaiClient = null;

/**
 * Returns vector embedding for the given text.
 * Falls back to stub mode if OPENAI_API_KEY is not set.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<EmbeddingResult>}
 */
export async function getEmbedding(text) {
  if (!llm.openaiApiKey || llm.openaiApiKey === 'sk-your-key-here') {
    console.warn('⚠️  OPENAI_API_KEY not set — using deterministic stub embedding');
    return _stubEmbedding(text);
  }

  try {
    return await _openAiEmbedding(text);
  } catch (err) {
    console.warn(`⚠️  OpenAI embedding failed (${err.message}), falling back to LangChain...`);
    return _langChainEmbedding(text);
  }
}

/**
 * Embeds an array of texts in a single batched API call.
 * @param {string[]} texts
 * @returns {Promise<EmbeddingResult[]>}
 */
export async function getBatchEmbeddings(texts) {
  if (!llm.openaiApiKey || llm.openaiApiKey === 'sk-your-key-here') {
    return Promise.all(texts.map(_stubEmbedding));
  }

  try {
    const client = await _getOpenAiClient();
    const response = await client.embeddings.create({
      model: llm.embeddingModel,
      input: texts,
    });

    return response.data.map((item, i) => ({
      embedding: item.embedding,
      model: response.model,
      tokenCount: Math.ceil(texts[i].length / 4), // rough approximation
    }));
  } catch (err) {
    console.warn(`⚠️  Batch embedding failed: ${err.message}`);
    return Promise.all(texts.map(_stubEmbedding));
  }
}

// ════════════════════════════════════════════════════════════════════
// Private — Provider Implementations
// ════════════════════════════════════════════════════════════════════

async function _openAiEmbedding(text) {
  const client = await _getOpenAiClient();
  const response = await client.embeddings.create({
    model: llm.embeddingModel,
    input: text,
  });

  return {
    embedding: response.data[0].embedding,
    model: response.model,
    tokenCount: response.usage?.total_tokens || 0,
  };
}

async function _langChainEmbedding(text) {
  // Dynamic import to avoid hard dependency if LangChain not installed
  const { OpenAIEmbeddings } = await import('@langchain/openai');
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: llm.openaiApiKey,
    modelName: llm.embeddingModel,
  });

  const vector = await embeddings.embedQuery(text);
  return {
    embedding: vector,
    model: `langchain/${llm.embeddingModel}`,
    tokenCount: 0,
  };
}

/**
 * Deterministic stub: generates a consistent pseudo-vector from text hash.
 * Used when no API key is configured. Returns 1536-dim vector.
 * @param {string} text
 * @returns {EmbeddingResult}
 */
function _stubEmbedding(text) {
  const DIMS = 1536;
  const seed = _hashString(text);
  const vector = Array.from({ length: DIMS }, (_, i) => {
    // Deterministic pseudo-random based on seed + index
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  });

  // L2-normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  const normalized = vector.map((v) => v / magnitude);

  return {
    embedding: normalized,
    model: 'stub-deterministic-hash',
    tokenCount: Math.ceil(text.length / 4),
  };
}

async function _getOpenAiClient() {
  if (!openaiClient) {
    const { OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: llm.openaiApiKey });
  }
  return openaiClient;
}

function _hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Force 32-bit int
  }
  return Math.abs(hash);
}
