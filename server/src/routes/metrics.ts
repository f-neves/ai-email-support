import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  // Aggregated stats for the dashboard.
  app.get('/api/metrics', async () => {
    const all = await prisma.email.findMany({
      select: {
        category: true,
        status: true,
        autoSent: true,
        confidence: true,
        receivedAt: true,
        sentAt: true,
      },
    });

    const total = all.length;

    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let autoSent = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;
    let resolutionMsSum = 0;
    let resolutionCount = 0;

    for (const e of all) {
      if (e.category) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      if (e.autoSent) autoSent++;
      if (typeof e.confidence === 'number') {
        confidenceSum += e.confidence;
        confidenceCount++;
      }
      if (e.sentAt) {
        resolutionMsSum += e.sentAt.getTime() - e.receivedAt.getTime();
        resolutionCount++;
      }
    }

    const sent = byStatus['sent'] ?? 0;

    return {
      total,
      byCategory,
      byStatus,
      sent,
      autoSent,
      // Share of all emails resolved automatically (no human in the loop).
      autoResolutionRate: total > 0 ? autoSent / total : 0,
      avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
      // Average time from receipt to send, in hours.
      avgResolutionHours:
        resolutionCount > 0 ? resolutionMsSum / resolutionCount / (1000 * 60 * 60) : null,
    };
  });
}
