import 'dotenv/config';

/**
 * Centralised, typed configuration loaded from environment variables.
 * Keeps the rest of the codebase free of `process.env` access and string parsing.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3001),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    maxRetries: num(process.env.ANTHROPIC_MAX_RETRIES, 3),
    classifyModel: 'claude-haiku-4-5',
    draftModel: 'claude-sonnet-4-6',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/auth/google/callback',
  },

  gmail: {
    label: process.env.GMAIL_LABEL ?? 'Suporte',
    maxResults: num(process.env.GMAIL_MAX_RESULTS, 20),
  },

  behaviour: {
    confidenceReviewThreshold: num(process.env.CONFIDENCE_REVIEW_THRESHOLD, 0.7),
    autoSendEnabled: bool(process.env.AUTO_SEND_ENABLED, false),
    autoSendThreshold: num(process.env.AUTO_SEND_THRESHOLD, 0.9),
    replyTone: process.env.REPLY_TONE ?? 'profissional, cordial e objetivo',
    companyName: process.env.COMPANY_NAME ?? 'Acme Suporte',
  },
};

/** A value counts as "set" only if it's non-empty and not one of the .env.example placeholders. */
function isRealValue(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v.length === 0) return false;
  // Reject the example placeholders so the no-key demo reports honestly.
  if (v.includes('...') || v.startsWith('your-')) return false;
  return true;
}

/** True when a real Anthropic key is configured (lets the UI/routes degrade gracefully). */
export const hasAnthropicKey = (): boolean => isRealValue(config.anthropic.apiKey);

/** True when real Google OAuth credentials are configured. */
export const hasGoogleCreds = (): boolean =>
  isRealValue(config.google.clientId) && isRealValue(config.google.clientSecret);
