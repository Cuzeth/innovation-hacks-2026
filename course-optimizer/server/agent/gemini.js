import { GoogleGenAI } from "@google/genai";

let ai = null;

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
 * Send a message using Gemini with conversation history.
 * @param {object} options
 * @param {string} options.systemPrompt - System instruction
 * @param {Array} options.history - Conversation history in Gemini format
 * @param {string} options.message - Current user message
 * @param {boolean} options.useSearch - Enable Google Search grounding
 * @returns {Promise<string>} Model response text
 */
export async function chat({ systemPrompt, history = [], message, useSearch = false }) {
  const client = getClient();

  const config = {
    systemInstruction: systemPrompt,
  };

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  const chatSession = client.chats.create({
    model: "gemini-2.0-flash",
    config,
    history,
  });

  const response = await chatSession.sendMessage({ message });
  return response.text;
}

/**
 * Single-shot generation (for research tasks).
 */
export async function generate({ prompt, useSearch = false }) {
  const client = getClient();

  const config = {};
  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config,
  });

  return response.text;
}

/**
 * Verify the API key works.
 */
export async function testConnection() {
  const client = getClient();
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: "Say hello in one word." }] }],
  });
  return response.text;
}
