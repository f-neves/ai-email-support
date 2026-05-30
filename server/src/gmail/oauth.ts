import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { config } from '../config.js';
import { prisma } from '../db.js';

/**
 * Gmail OAuth2 helpers.
 *
 * Flow: the UI hits /api/auth/google → we redirect the user to Google's consent
 * screen → Google calls back to GOOGLE_REDIRECT_URI with a code → we exchange it
 * for tokens and persist them (single-row OAuthToken table). The refresh token
 * lets us keep access without re-prompting; we re-save credentials whenever the
 * library refreshes them.
 */

// We need to read AND send mail, plus modify (to mark messages read).
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/** URL to send the user to for consent. `prompt: 'consent'` forces a refresh token. */
export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/** Exchanges the OAuth code for tokens and stores them. */
export async function handleCallback(code: string): Promise<void> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Best-effort: capture which account we connected to (nice for the UI).
  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    /* non-fatal */
  }

  await saveTokens(tokens, email);
}

async function saveTokens(tokens: Credentials, email?: string | null): Promise<void> {
  const existing = await prisma.oAuthToken.findUnique({ where: { id: 1 } });
  // Preserve a previously-stored refresh_token if Google omits it on refresh.
  const merged: Credentials = { ...(existing ? JSON.parse(existing.tokens) : {}), ...tokens };

  await prisma.oAuthToken.upsert({
    where: { id: 1 },
    create: { id: 1, tokens: JSON.stringify(merged), email: email ?? undefined },
    update: { tokens: JSON.stringify(merged), ...(email ? { email } : {}) },
  });
}

/**
 * Returns an authenticated client ready for Gmail API calls, or null if the user
 * hasn't connected an account yet. Auto-persists refreshed tokens.
 */
export async function getAuthedClient(): Promise<OAuth2Client | null> {
  const row = await prisma.oAuthToken.findUnique({ where: { id: 1 } });
  if (!row) return null;

  const client = createOAuthClient();
  client.setCredentials(JSON.parse(row.tokens) as Credentials);

  // Persist tokens whenever the library refreshes them under the hood.
  client.on('tokens', (tokens) => {
    void saveTokens(tokens);
  });

  return client;
}

export interface AuthStatus {
  connected: boolean;
  email: string | null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const row = await prisma.oAuthToken.findUnique({ where: { id: 1 } });
  return { connected: !!row, email: row?.email ?? null };
}

export async function disconnect(): Promise<void> {
  await prisma.oAuthToken.deleteMany({});
}
