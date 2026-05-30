import { google } from 'googleapis';
import type { Email } from '@prisma/client';
import { getAuthedClient } from './oauth.js';

/**
 * Sends a reply to a customer email, in the same Gmail thread.
 *
 * We build a minimal RFC 2822 message: To / Subject (Re:) / In-Reply-To /
 * References, base64url-encode it, and post it with the original threadId so
 * Gmail threads it correctly.
 */

/** Extracts a bare `address@domain` from a possibly-formatted From header. */
function extractAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

function buildRawMessage(opts: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}): string {
  const subject = opts.subject.toLowerCase().startsWith('re:')
    ? opts.subject
    : `Re: ${opts.subject}`;

  // Encode the subject as UTF-8 (RFC 2047) so accents survive.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ];

  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  const raw = `${headers.join('\r\n')}\r\n\r\n${opts.body}`;
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

export async function sendReply(email: Email, body: string): Promise<void> {
  const auth = await getAuthedClient();
  if (!auth) {
    throw new Error('Gmail não conectado: não é possível enviar a resposta.');
  }

  const gmail = google.gmail({ version: 'v1', auth });

  // Look up the original message's Message-ID so the reply threads properly.
  let inReplyTo: string | undefined;
  if (email.gmailId) {
    try {
      const original = await gmail.users.messages.get({
        userId: 'me',
        id: email.gmailId,
        format: 'metadata',
        metadataHeaders: ['Message-ID'],
      });
      inReplyTo =
        original.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')
          ?.value ?? undefined;
    } catch {
      /* non-fatal: still send, just maybe not perfectly threaded */
    }
  }

  const raw = buildRawMessage({
    to: extractAddress(email.sender),
    subject: email.subject,
    body,
    inReplyTo,
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: email.threadId ?? undefined,
    },
  });

  // Mark the original as read so it won't be re-imported on the next sync.
  if (email.gmailId) {
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: email.gmailId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    } catch {
      /* non-fatal */
    }
  }
}
