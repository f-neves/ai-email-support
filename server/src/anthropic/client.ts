import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/**
 * Shared Anthropic client.
 *
 * `maxRetries` is handled by the SDK itself: it retries 429 (rate limit) and
 * 5xx responses with exponential backoff. We pair this with a concurrency
 * limiter (see rateLimit.ts) around the call sites.
 */
export const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  maxRetries: config.anthropic.maxRetries,
});
