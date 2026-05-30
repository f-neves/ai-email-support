import { google, type gmail_v1 } from 'googleapis';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { getAuthedClient } from './oauth.js';

/**
 * Imports unread messages from the configured Gmail label into the DB.
 *
 * Uses a Gmail search query (`label:<name> is:unread`) so we don't need to
 * resolve a label id first. Each message is upserted by its Gmail id (unique),
 * so re-syncing is idempotent and won't create duplicates.
 */

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  const headers = payload?.headers ?? [];
  const found = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? '';
}

/** Decodes Gmail's base64url body data. */
function decodeBody(data: string | null | undefined): string {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/** Very small HTML→text fallback for messages without a text/plain part. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Recursively extracts the best textual body from a message payload. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // Prefer text/plain at the top level.
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  const parts = payload.parts ?? [];

  const plain = parts.find((p) => p.mimeType === 'text/plain');
  if (plain?.body?.data) return decodeBody(plain.body.data);

  // Recurse into nested multiparts.
  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  const html = parts.find((p) => p.mimeType === 'text/html');
  if (html?.body?.data) return htmlToText(decodeBody(html.body.data));
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return htmlToText(decodeBody(payload.body.data));
  }

  return '';
}

export interface SyncResult {
  imported: number;
  skipped: number;
}

export async function syncEmails(): Promise<SyncResult> {
  const auth = await getAuthedClient();
  if (!auth) {
    throw new Error('Gmail não conectado. Conecte uma conta em Configurações.');
  }

  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: `label:${config.gmail.label} is:unread`,
    maxResults: config.gmail.maxResults,
  });

  const messages = list.data.messages ?? [];
  let imported = 0;
  let skipped = 0;

  for (const { id } of messages) {
    if (!id) continue;

    // Skip messages we've already imported.
    const existing = await prisma.email.findUnique({ where: { gmailId: id } });
    if (existing) {
      skipped++;
      continue;
    }

    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const payload = full.data.payload;

    const from = header(payload, 'From');
    const subject = header(payload, 'Subject') || '(sem assunto)';
    const dateHeader = header(payload, 'Date');
    const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
    const body = extractBody(payload) || full.data.snippet || '';

    await prisma.email.create({
      data: {
        gmailId: id,
        threadId: full.data.threadId ?? null,
        sender: from,
        subject,
        body,
        receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
        status: 'pending',
      },
    });
    imported++;
  }

  return { imported, skipped };
}
