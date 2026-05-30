import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, hasAnthropicKey, hasGoogleCreds } from './config.js';
import { authRoutes } from './routes/auth.js';
import { emailRoutes } from './routes/emails.js';
import { metricsRoutes } from './routes/metrics.js';

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

await app.register(cors, { origin: true });

// Health + capability flags, so the SPA can adapt (e.g. hide Gmail buttons,
// warn when the Anthropic key is missing) without guessing.
app.get('/api/config', async () => ({
  anthropicConfigured: hasAnthropicKey(),
  googleConfigured: hasGoogleCreds(),
  reviewThreshold: config.behaviour.confidenceReviewThreshold,
  autoSendEnabled: config.behaviour.autoSendEnabled,
  autoSendThreshold: config.behaviour.autoSendThreshold,
  companyName: config.behaviour.companyName,
  gmailLabel: config.gmail.label,
}));

await app.register(authRoutes);
await app.register(emailRoutes);
await app.register(metricsRoutes);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`AI Email Support API on http://localhost:${config.port}`);
  if (!hasAnthropicKey()) {
    app.log.warn('ANTHROPIC_API_KEY ausente — a IA ficará desabilitada até configurá-la.');
  }
  if (!hasGoogleCreds()) {
    app.log.warn('Credenciais Google ausentes — sincronização/envio via Gmail desabilitados.');
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
