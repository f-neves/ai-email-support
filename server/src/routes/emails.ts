import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { processEmail, processPending } from '../pipeline.js';
import { syncEmails } from '../gmail/sync.js';
import { sendReply } from '../gmail/send.js';

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // List emails, newest first, optionally filtered by status.
  app.get<{ Querystring: { status?: string } }>('/api/emails', async (req) => {
    const { status } = req.query;
    const where = status && status !== 'all' ? { status } : {};
    const emails = await prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
    });
    return { emails, reviewThreshold: config.behaviour.confidenceReviewThreshold };
  });

  // Single email.
  app.get<{ Params: { id: string } }>('/api/emails/:id', async (req, reply) => {
    const email = await prisma.email.findUnique({ where: { id: req.params.id } });
    if (!email) return reply.code(404).send({ error: 'E-mail não encontrado.' });
    return { email };
  });

  // Edit the draft text.
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/emails/:id/draft',
    async (req, reply) => {
      const parsed = z.object({ draft: z.string() }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Campo "draft" inválido.' });

      const exists = await prisma.email.findUnique({ where: { id: req.params.id } });
      if (!exists) return reply.code(404).send({ error: 'E-mail não encontrado.' });

      const email = await prisma.email.update({
        where: { id: req.params.id },
        data: { draft: parsed.data.draft, status: 'reviewed' },
      });
      return { email };
    }
  );

  // Run (or re-run) the AI pipeline for one email.
  app.post<{ Params: { id: string } }>('/api/emails/:id/process', async (req, reply) => {
    try {
      const email = await processEmail(req.params.id);
      return { email };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao processar.';
      return reply.code(502).send({ error: message });
    }
  });

  // Approve & send: deliver the (possibly edited) draft via Gmail, mark as sent.
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/emails/:id/approve',
    async (req, reply) => {
      const email = await prisma.email.findUnique({ where: { id: req.params.id } });
      if (!email) return reply.code(404).send({ error: 'E-mail não encontrado.' });

      // Allow sending an edited body straight from the detail view.
      const parsed = z.object({ draft: z.string().optional() }).safeParse(req.body ?? {});
      const body = (parsed.success && parsed.data.draft) || email.draft;
      if (!body) return reply.code(400).send({ error: 'Não há rascunho para enviar.' });

      // Seeded/demo emails have no Gmail thread → can't actually send.
      if (!email.gmailId || !email.threadId) {
        return reply.code(400).send({
          error:
            'Este e-mail não veio do Gmail (ex.: dados de seed), então não pode ser enviado de verdade.',
        });
      }

      try {
        await sendReply(email, body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao enviar.';
        return reply.code(502).send({ error: message });
      }

      const updated = await prisma.email.update({
        where: { id: req.params.id },
        data: { draft: body, status: 'sent', sentAt: new Date(), error: null },
      });
      return { email: updated };
    }
  );

  // Discard: take the email out of the queue without replying.
  app.post<{ Params: { id: string } }>('/api/emails/:id/discard', async (req, reply) => {
    const exists = await prisma.email.findUnique({ where: { id: req.params.id } });
    if (!exists) return reply.code(404).send({ error: 'E-mail não encontrado.' });

    const email = await prisma.email.update({
      where: { id: req.params.id },
      data: { status: 'discarded' },
    });
    return { email };
  });

  // Pull new unread mail from the "Suporte" label and (optionally) process it.
  app.post<{ Querystring: { process?: string } }>('/api/sync', async (req, reply) => {
    try {
      const result = await syncEmails();
      let processedResult = { processed: 0, failed: 0 };
      if (req.query.process !== 'false') {
        processedResult = await processPending();
      }
      return { ...result, ...processedResult };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao sincronizar.';
      return reply.code(502).send({ error: message });
    }
  });

  // Process all unanalysed emails (handy for seeded data).
  app.post('/api/process-pending', async (_req, reply) => {
    try {
      const result = await processPending();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao processar.';
      return reply.code(502).send({ error: message });
    }
  });
}
