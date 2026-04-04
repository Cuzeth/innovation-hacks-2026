import { GoogleGenAI } from "@google/genai";

let ai = null;

const PRIMARY_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "gemini-2.0-flash-lite";
const MAX_RETRIES = 3;

function getClient() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

/**
 * Sleep for the given ms.
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse retry delay from a 429 error. Returns ms to wait, or a default.
 */
function getRetryDelay(err, attempt) {
  // Try to extract retryDelay from the error details
  const match = err?.message?.match(/retryDelay":"(\d+)s"/);
  if (match) return parseInt(match[1], 10) * 1000 + 1000; // add 1s buffer
  // Exponential backoff: 5s, 15s, 45s
  return 5000 * Math.pow(3, attempt);
}

/**
 * Execute a Gemini call with retry + model fallback on 429.
 */
async function withRetry(fn) {
  let lastError;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        lastError = err;
        const is429 = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");

        if (!is429) throw err; // non-rate-limit error, don't retry

        const delay = getRetryDelay(err, attempt);
        console.warn(`Rate limited on ${model} (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
      }
    }
    console.warn(`Exhausted retries on ${model}, trying fallback...`);
  }

  throw lastError;
}

/**
 * Send a message using Gemini with conversation history.
 */
export async function chat({ systemPrompt, history = [], message, useSearch = false }) {
  const client = getClient();

  return withRetry(async (model) => {
    const config = { systemInstruction: systemPrompt };
    if (useSearch) config.tools = [{ googleSearch: {} }];

    const chatSession = client.chats.create({ model, config, history });
    const response = await chatSession.sendMessage({ message });
    return response.text;
  });
}

/**
 * Single-shot generation (for research tasks).
 */
export async function generate({ prompt, useSearch = false }) {
  const client = getClient();

  return withRetry(async (model) => {
    const config = {};
    if (useSearch) config.tools = [{ googleSearch: {} }];

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });
    return response.text;
  });
}

/**
 * Verify the API key works.
 */
export async function testConnection() {
  const client = getClient();

  return withRetry(async (model) => {
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Say hello in one word." }] }],
    });
    return response.text;
  });
}
