// Small presentational helpers for category / urgency / status / confidence.

const CATEGORY_LABELS: Record<string, string> = {
  duvida: 'Dúvida',
  reclamacao: 'Reclamação',
  elogio: 'Elogio',
  suporte_tecnico: 'Suporte técnico',
  financeiro: 'Financeiro',
  outro: 'Outro',
};

const CATEGORY_STYLES: Record<string, string> = {
  duvida: 'bg-sky-100 text-sky-700',
  reclamacao: 'bg-rose-100 text-rose-700',
  elogio: 'bg-emerald-100 text-emerald-700',
  suporte_tecnico: 'bg-violet-100 text-violet-700',
  financeiro: 'bg-amber-100 text-amber-700',
  outro: 'bg-slate-100 text-slate-600',
};

const URGENCY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const URGENCY_STYLES: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-700',
  alta: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  reviewed: 'Revisado',
  sent: 'Enviado',
  discarded: 'Descartado',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-indigo-100 text-indigo-700',
  sent: 'bg-emerald-100 text-emerald-700',
  discarded: 'bg-slate-200 text-slate-500',
};

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function CategoryBadge({ value }: { value: string | null }) {
  if (!value) return <Pill className="bg-slate-100 text-slate-400">—</Pill>;
  return (
    <Pill className={CATEGORY_STYLES[value] ?? CATEGORY_STYLES.outro}>
      {CATEGORY_LABELS[value] ?? value}
    </Pill>
  );
}

export function UrgencyBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <Pill className={URGENCY_STYLES[value] ?? URGENCY_STYLES.media}>
      {URGENCY_LABELS[value] ?? value}
    </Pill>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Pill className={STATUS_STYLES[value] ?? STATUS_STYLES.pending}>
      {STATUS_LABELS[value] ?? value}
    </Pill>
  );
}

export function ReviewBadge() {
  return (
    <Pill className="bg-orange-100 text-orange-700">
      <span className="mr-1">⚠</span> revisar
    </Pill>
  );
}

export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? 'bg-emerald-500' : value >= 0.7 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2" title={`Confiança: ${pct}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
    </div>
  );
}

export { CATEGORY_LABELS };
