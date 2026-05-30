import { useEffect, useState } from 'react';
import type { AppConfig, AuthStatus, Email } from '../types';
import { CategoryBadge, ConfidenceMeter, ReviewBadge, StatusBadge, UrgencyBadge } from './Badges';

interface Props {
  email: Email | null;
  config: AppConfig | null;
  auth: AuthStatus | null;
  onSaveDraft: (id: string, draft: string) => Promise<void>;
  onProcess: (id: string) => Promise<void>;
  onApprove: (id: string, draft: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

type BusyAction = 'save' | 'process' | 'approve' | 'discard' | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function EmailDetail({ email, config, auth, onSaveDraft, onProcess, onApprove, onDiscard }: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);

  // Reset the editor whenever a different email is selected (or it updates).
  useEffect(() => {
    setDraft(email?.draft ?? '');
  }, [email?.id, email?.draft]);

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">✉️</div>
        <p className="font-medium text-slate-600">Selecione um e-mail</p>
        <p className="max-w-sm text-sm text-slate-400">
          Escolha um e-mail na lista à esquerda para ver os detalhes, revisar o rascunho gerado pela
          IA e aprovar ou descartar.
        </p>
      </div>
    );
  }

  const reviewThreshold = config?.reviewThreshold ?? 0.7;
  const needsReview =
    email.confidence !== null && email.confidence < reviewThreshold && email.status !== 'sent';
  const isSeed = !email.gmailId;
  const canSend = !isSeed && (auth?.connected ?? false);
  const isClosed = email.status === 'sent' || email.status === 'discarded';
  const dirty = draft !== (email.draft ?? '');

  const run = async (action: BusyAction, fn: () => Promise<void>) => {
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{email.subject}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">{email.sender}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{formatDate(email.receivedAt)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CategoryBadge value={email.category} />
          <UrgencyBadge value={email.urgency} />
          <StatusBadge value={email.status} />
          {needsReview && <ReviewBadge />}
          {email.autoSent && (
            <span className="text-xs text-emerald-600">enviado automaticamente</span>
          )}
          <div className="ml-auto">
            <ConfidenceMeter value={email.confidence} />
          </div>
        </div>
        {email.summary && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Resumo: </span>
            {email.summary}
          </p>
        )}
      </div>

      {/* Body + draft (scrollable) */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            E-mail do cliente
          </h3>
          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
            {email.body}
          </div>
        </section>

        {email.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="font-medium">Erro no processamento: </span>
            {email.error}
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Rascunho de resposta {dirty && <span className="text-amber-500">(não salvo)</span>}
            </h3>
            <button
              onClick={() => run('process', () => onProcess(email.id))}
              disabled={!!busy || !config?.anthropicConfigured}
              title={
                config?.anthropicConfigured
                  ? 'Reclassifica e regenera o rascunho com a IA'
                  : 'Configure ANTHROPIC_API_KEY para usar a IA'
              }
              className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {busy === 'process' ? 'Processando…' : '↻ Reprocessar com IA'}
            </button>
          </div>

          {email.draft || email.status !== 'pending' || draft ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isClosed}
              rows={12}
              placeholder="O rascunho gerado pela IA aparecerá aqui…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              Ainda não há rascunho. Clique em <span className="font-medium">Reprocessar com IA</span>{' '}
              para gerar uma resposta.
            </div>
          )}
        </section>
      </div>

      {/* Actions */}
      {!isClosed && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={() => run('approve', () => onApprove(email.id, draft))}
            disabled={!!busy || !draft.trim() || !canSend}
            title={
              isSeed
                ? 'E-mail de exemplo (seed): não há thread real do Gmail para responder.'
                : !auth?.connected
                  ? 'Conecte uma conta do Gmail para enviar.'
                  : 'Envia a resposta no mesmo thread do Gmail.'
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy === 'approve' ? 'Enviando…' : '✓ Aprovar & Enviar'}
          </button>

          <button
            onClick={() => run('save', () => onSaveDraft(email.id, draft))}
            disabled={!!busy || !dirty}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'save' ? 'Salvando…' : 'Salvar rascunho'}
          </button>

          <button
            onClick={() => run('discard', () => onDiscard(email.id))}
            disabled={!!busy}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            {busy === 'discard' ? 'Descartando…' : 'Descartar'}
          </button>
        </div>
      )}

      {isClosed && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-500">
          {email.status === 'sent'
            ? `Resposta enviada${email.sentAt ? ` em ${formatDate(email.sentAt)}` : ''}.`
            : 'E-mail descartado.'}
        </div>
      )}
    </div>
  );
}
