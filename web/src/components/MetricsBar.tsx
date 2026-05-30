import type { Metrics } from '../types';
import { CATEGORY_LABELS } from './Badges';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function MetricsBar({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) return null;

  const topCategory = Object.entries(metrics.byCategory).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Total de e-mails" value={String(metrics.total)} />
      <Stat label="Enviados" value={String(metrics.sent)} hint={`${metrics.autoSent} automáticos`} />
      <Stat
        label="Auto-resolução"
        value={`${Math.round(metrics.autoResolutionRate * 100)}%`}
        hint="resolvidos sem revisão"
      />
      <Stat
        label="Confiança média"
        value={metrics.avgConfidence !== null ? `${Math.round(metrics.avgConfidence * 100)}%` : '—'}
      />
      <Stat
        label="Categoria principal"
        value={topCategory ? (CATEGORY_LABELS[topCategory[0]] ?? topCategory[0]) : '—'}
        hint={topCategory ? `${topCategory[1]} e-mail(s)` : undefined}
      />
    </div>
  );
}
