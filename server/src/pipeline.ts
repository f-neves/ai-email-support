import type { Email } from '@prisma/client';
import { prisma } from './db.js';
import { config, hasAnthropicKey } from './config.js';
import { classifyEmail } from './anthropic/classify.js';
import { generateDraft } from './anthropic/draft.js';
import { sendReply } from './gmail/send.js';

/**
 * Runs the full AI pipeline for one email:
 *   1. classify (haiku)  →  2. draft a reply (sonnet)  →  3. optional auto-send.
 *
 * Persists results (and any error) to the DB and returns the updated row.
 */
export async function processEmail(emailId: string): Promise<Email> {
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) throw new Error(`E-mail ${emailId} não encontrado.`);

  if (!hasAnthropicKey()) {
    throw new Error(
      'ANTHROPIC_API_KEY não configurada. Defina-a no server/.env para usar a IA.'
    );
  }

  try {
    const classification = await classifyEmail(email);
    const draft = await generateDraft(email, classification);

    let status = 'pending';
    let autoSent = false;
    let sentAt: Date | null = null;

    // Auto-send only when explicitly enabled, confident enough, and a thread to reply to exists.
    const eligibleForAutoSend =
      config.behaviour.autoSendEnabled &&
      draft.confianca >= config.behaviour.autoSendThreshold &&
      !!email.gmailId &&
      !!email.threadId;

    if (eligibleForAutoSend) {
      await sendReply(email, draft.resposta);
      status = 'sent';
      autoSent = true;
      sentAt = new Date();
    }

    return prisma.email.update({
      where: { id: emailId },
      data: {
        category: classification.categoria,
        urgency: classification.urgencia,
        language: classification.idioma,
        summary: classification.resumo,
        draft: draft.resposta,
        confidence: draft.confianca,
        status,
        autoSent,
        sentAt,
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.email.update({
      where: { id: emailId },
      data: { error: message },
    });
    throw err;
  }
}

/**
 * Processes every email that hasn't been analysed yet (no category).
 * Errors on individual emails are captured per-row and don't abort the batch.
 */
export async function processPending(): Promise<{ processed: number; failed: number }> {
  const pending = await prisma.email.findMany({
    where: { category: null, status: 'pending' },
    select: { id: true },
  });

  let processed = 0;
  let failed = 0;

  // Kick them off together; the claudeLimiter caps real concurrency.
  await Promise.all(
    pending.map(async ({ id }) => {
      try {
        await processEmail(id);
        processed++;
      } catch {
        failed++;
      }
    })
  );

  return { processed, failed };
}
