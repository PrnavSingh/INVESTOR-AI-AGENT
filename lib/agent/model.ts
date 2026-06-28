import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * ══════════════════════════════════════════════════════════════
 * LLM Configuration — Gemini 2.5 Flash (Google DeepMind)
 * ══════════════════════════════════════════════════════════════
 *
 * Model:        gemini-2.5-flash
 * Provider:     Google Generative AI (via @langchain/google-genai)
 * API Version:  v1beta
 * Context:      1,048,576 tokens (1M)
 * Max Output:   8,192 tokens (capped at 4,096 here for cost efficiency)
 * Temperature:  0.3 (low — prioritize factual, deterministic output)
 *
 * Why Gemini 2.5 Flash?
 * ─────────────────────
 * 1. Speed:   Flash models are optimized for low-latency inference,
 *             crucial for real-time SSE streaming in the agent pipeline.
 * 2. Quality: 2.5-generation delivers strong structured output (JSON)
 *             and reasoning — essential for financial analysis tasks.
 * 3. Cost:    Free-tier access via Google AI Studio API key.
 * 4. Structured Output: Excellent at generating valid JSON for
 *             sentiment scores, verdict objects, and research plans.
 *
 * Rate Limiting Strategy:
 * ───────────────────────
 * Free-tier Gemini has strict per-minute quotas. We handle this with
 * exponential backoff retry (see withRetry below). Each agent node
 * makes 1 LLM call, and we space retries at 20s → 40s → 60s to
 * stay within limits even under heavy usage.
 *
 * The model is instantiated per-call (not singleton) to avoid
 * stale connection issues in serverless environments (Vercel).
 * ══════════════════════════════════════════════════════════════
 */
export function getModel() {
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.3,
    maxOutputTokens: 4096,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

/**
 * ══════════════════════════════════════════════════════════════
 * Retry Wrapper — Exponential Backoff for Rate Limits
 * ══════════════════════════════════════════════════════════════
 *
 * Handles Gemini free-tier rate limits (HTTP 429 / RESOURCE_EXHAUSTED).
 *
 * Strategy:
 *   Attempt 1 → immediate
 *   Attempt 2 → wait 20s
 *   Attempt 3 → wait 40s
 *   Attempt 4 → wait 60s  (final attempt)
 *
 * This covers the typical 60-second rate limit window on free tier.
 * Non-rate-limit errors are thrown immediately without retry.
 * ══════════════════════════════════════════════════════════════
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 20000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorString = String(error) + (error instanceof Error ? error.message : "");
      const isRateLimit =
        errorString.includes("429") ||
        errorString.includes("RESOURCE_EXHAUSTED") ||
        errorString.includes("quota") ||
        errorString.includes("Too Many Requests");

      if (isRateLimit && attempt < maxRetries) {
        const delay = baseDelayMs * (attempt + 1);
        console.log(`[Rate limit] Attempt ${attempt + 1}/${maxRetries}, waiting ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}
