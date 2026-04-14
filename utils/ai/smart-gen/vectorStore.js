/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/smart-gen/vectorStore.js — Vector Database Client
 *
 * Abstracts over 3 provider modes:
 *  1. ChromaDB  (local Docker instance)
 *  2. Pinecone  (cloud, production)
 *  3. Memory    (in-process, no dependencies — default for CI)
 *
 * All providers expose the same interface:
 *   upsertFeature(id, embedding, metadata)
 *   querySimilar(embedding, topK) → [{id, metadata, score}]
 *   deleteFeature(id)
 * ═══════════════════════════════════════════════════════════════════
 */
import { frameworkConfig } from '../../../config/framework.config.js';

const { vectorDb } = frameworkConfig;

// ════════════════════════════════════════════════════════════════════
// In-Memory Fallback Store
// ════════════════════════════════════════════════════════════════════

class MemoryVectorStore {
  constructor() {
    this.store = new Map(); // id → { embedding, metadata }
    console.log('📦 VectorStore: using in-memory provider (no persistence)');
  }

  async upsertFeature(id, embedding, metadata) {
    this.store.set(id, { embedding, metadata });
  }

  async querySimilar(queryEmbedding, topK = 5) {
    const results = [];
    for (const [id, { embedding, metadata }] of this.store.entries()) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      results.push({ id, metadata, score });
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteFeature(id) {
    this.store.delete(id);
  }

  get size() {
    return this.store.size;
  }
}

// ════════════════════════════════════════════════════════════════════
// ChromaDB Provider
// ════════════════════════════════════════════════════════════════════

class ChromaVectorStore {
  constructor() {
    this.collectionName = vectorDb.chroma.collection;
    this._collection = null;
    console.log(`🔵 VectorStore: ChromaDB @ ${vectorDb.chroma.host}:${vectorDb.chroma.port}`);
  }

  async _init() {
    if (this._collection) return;
    const { ChromaClient } = await import('chromadb');
    const client = new ChromaClient({
      path: `http://${vectorDb.chroma.host}:${vectorDb.chroma.port}`,
    });
    this._collection = await client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  async upsertFeature(id, embedding, metadata) {
    await this._init();
    await this._collection.upsert({
      ids: [id],
      embeddings: [embedding],
      metadatas: [metadata],
    });
  }

  async querySimilar(queryEmbedding, topK = 5) {
    await this._init();
    const results = await this._collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
    });

    return (results.ids[0] || []).map((id, i) => ({
      id,
      metadata: results.metadatas[0][i],
      score: 1 - (results.distances[0][i] || 0), // cosine distance → similarity
    }));
  }

  async deleteFeature(id) {
    await this._init();
    await this._collection.delete({ ids: [id] });
  }
}

// ════════════════════════════════════════════════════════════════════
// Pinecone Provider
// ════════════════════════════════════════════════════════════════════

class PineconeVectorStore {
  constructor() {
    this._index = null;
    console.log(`🟣 VectorStore: Pinecone @ ${vectorDb.pinecone.environment}`);
  }

  async _init() {
    if (this._index) return;
    const { Pinecone } = await import('@pinecone-database/pinecone');
    const client = new Pinecone({ apiKey: vectorDb.pinecone.apiKey });
    this._index = client.index(vectorDb.pinecone.index);
  }

  async upsertFeature(id, embedding, metadata) {
    await this._init();
    await this._index.upsert([{ id, values: embedding, metadata }]);
  }

  async querySimilar(queryEmbedding, topK = 5) {
    await this._init();
    const results = await this._index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return (results.matches || []).map((match) => ({
      id: match.id,
      metadata: match.metadata,
      score: match.score,
    }));
  }

  async deleteFeature(id) {
    await this._init();
    await this._index.deleteOne(id);
  }
}

// ════════════════════════════════════════════════════════════════════
// Factory
// ════════════════════════════════════════════════════════════════════

let _instance = null;

/**
 * Returns the active VectorStore instance (singleton).
 * Provider is selected based on VECTOR_DB_PROVIDER env var.
 * @returns {MemoryVectorStore|ChromaVectorStore|PineconeVectorStore}
 */
export function getVectorStore() {
  if (_instance) return _instance;

  switch (vectorDb.provider) {
    case 'chroma':
      _instance = new ChromaVectorStore();
      break;
    case 'pinecone':
      _instance = new PineconeVectorStore();
      break;
    default:
      _instance = new MemoryVectorStore();
  }

  return _instance;
}

// ════════════════════════════════════════════════════════════════════
// Math Utilities
// ════════════════════════════════════════════════════════════════════

/**
 * Computes cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Value in [0, 1] — higher = more similar
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
