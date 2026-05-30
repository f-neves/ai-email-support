import type { FastifyInstance } from 'fastify';
import { hasGoogleCreds } from '../config.js';
import { disconnect, getAuthStatus, getAuthUrl, handleCallback } from '../gmail/oauth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Connection status for the UI.
  app.get('/api/auth/status', async () => {
    const status = await getAuthStatus();
    return { ...status, configured: hasGoogleCreds() };
  });

  // Kick off the OAuth consent flow.
  app.get('/api/auth/google', async (_req, reply) => {
    if (!hasGoogleCreds()) {
      return reply.code(400).send({ error: 'Credenciais Google não configuradas no .env.' });
    }
    return reply.redirect(getAuthUrl());
  });

  // Google redirects here with ?code=...
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/api/auth/google/callback',
    async (req, reply) => {
      const { code, error } = req.query;
      if (error) return reply.redirect(`/?auth=error&reason=${encodeURIComponent(error)}`);
      if (!code) return reply.redirect('/?auth=error&reason=missing_code');

      try {
        await handleCallback(code);
        // Bounce back to the SPA, which shows a success toast.
        return reply.redirect('/?auth=success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        return reply.redirect(`/?auth=error&reason=${encodeURIComponent(message)}`);
      }
    }
  );

  app.post('/api/auth/disconnect', async () => {
    await disconnect();
    return { ok: true };
  });
}
