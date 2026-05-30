import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from './api';
import type { AppConfig, AuthStatus, Email, Metrics } from './types';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'reviewed', label: 'Revisados' },
  { key: 'sent', label: 'Enviados' },
  { key: 'discarded', label: 'Descartados' },
] as const;

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [reviewThreshold, setReviewThreshold] = useState(0.7);

  const [filter, setFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [headerBusy, setHeaderBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedId) ?? null,
    [emails, selectedId]
  );

  // ── Data loading ────────────────────────────────────────────────────────
  const loadEmails = useCallback(async (status: string) => {
    setLoadingEmails(true);
    setLoadError(null);
    try {
      const { emails: list, reviewThreshold: rt } = await api.getEmails(status);
      setEmails(list);
      setReviewThreshold(rt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar e-mails.');
    } finally {
      setLoadingEmails(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await api.getMetrics());
    } catch {
      /* metrics are non-critical */
    }
  }, []);

  // Initial load + handle the OAuth redirect (?auth=success|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    if (authResult === 'success') {
      toast.success('Gmail conectado com sucesso!');
    } else if (authResult === 'error') {
      toast.error(`Falha ao conectar o Gmail: ${params.get('reason') ?? 'erro desconhecido'}`);
    }
    if (authResult) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    void api.getConfig().then(setConfig).catch(() => undefined);
    void api.getAuthStatus().then(setAuth).catch(() => undefined);
    void loadMetrics();
  }, [loadMetrics]);

  // Reload the list whenever the filter changes.
  useEffect(() => {
    void loadEmails(filter);
  }, [filter, loadEmails]);

  const refresh = useCallback(async () => {
    await Promise.all([loadEmails(filter), loadMetrics()]);
  }, [filter, loadEmails, loadMetrics]);

  // Replace one email in local state (after an action) to keep the UI snappy.
  const patchEmail = useCallback((updated: Email) => {
    setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleSaveDraft = useCallback(
    async (id: string, draft: string) => {
      try {
        const { email } = await api.updateDraft(id, draft);
        patchEmail(email);
        toast.success('Rascunho salvo.');
        void loadMetrics();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
      }
    },
    [patchEmail, loadMetrics]
  );

  const handleProcess = useCallback(
    async (id: string) => {
      const t = toast.loading('Processando com IA…');
      try {
        const { email } = await api.processEmail(id);
        patchEmail(email);
        toast.success('E-mail processado.', { id: t });
        void loadMetrics();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao processar.', { id: t });
      }
    },
    [patchEmail, loadMetrics]
  );

  const handleApprove = useCallback(
    async (id: string, draft: string) => {
      const t = toast.loading('Enviando resposta…');
      try {
        const { email } = await api.approve(id, draft);
        patchEmail(email);
        toast.success('Resposta enviada!', { id: t });
        void refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar.', { id: t });
      }
    },
    [patchEmail, refresh]
  );

  const handleDiscard = useCallback(
    async (id: string) => {
      try {
        const { email } = await api.discard(id);
        patchEmail(email);
        toast('E-mail descartado.', { icon: '🗑️' });
        void loadMetrics();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao descartar.');
      }
    },
    [patchEmail, loadMetrics]
  );

  const handleSync = useCallback(async () => {
    setHeaderBusy(true);
    const t = toast.loading('Sincronizando Gmail…');
    try {
      const r = await api.sync();
      toast.success(
        `Importados ${r.imported}, processados ${r.processed}` +
          (r.failed ? `, ${r.failed} com erro` : ''),
        { id: t }
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar.', { id: t });
    } finally {
      setHeaderBusy(false);
    }
  }, [refresh]);

  const handleProcessPending = useCallback(async () => {
    setHeaderBusy(true);
    const t = toast.loading('Processando pendentes…');
    try {
      const r = await api.processPending();
      toast.success(`Processados ${r.processed}${r.failed ? `, ${r.failed} com erro` : ''}.`, {
        id: t,
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar.', { id: t });
    } finally {
      setHeaderBusy(false);
    }
  }, [refresh]);

  const handleDisconnect = useCallback(async () => {
    try {
      await api.disconnect();
      setAuth({ connected: false, email: null, configured: auth?.configured ?? true });
      toast('Gmail desconectado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar.');
    }
  }, [auth]);

  return (
    <div className="flex h-full flex-col">
      <Header
        config={config}
        auth={auth}
        busy={headerBusy}
        onSync={handleSync}
        onProcessPending={handleProcessPending}
        onDisconnect={handleDisconnect}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
        <MetricsBar metrics={metrics} />

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Master-detail */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[380px_1fr]">
          <section className="flex max-h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500">
              Caixa de entrada
              {!loadingEmails && <span className="ml-1 text-slate-400">({emails.length})</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <div className="text-3xl">⚠️</div>
                  <p className="text-sm text-slate-500">{loadError}</p>
                  <button
                    onClick={() => void loadEmails(filter)}
                    className="mt-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <EmailList
                  emails={emails}
                  selectedId={selectedId}
                  onSelect={(e) => setSelectedId(e.id)}
                  reviewThreshold={reviewThreshold}
                  loading={loadingEmails}
                />
              )}
            </div>
          </section>

          <section className="max-h-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <EmailDetail
              email={selectedEmail}
              config={config}
              auth={auth}
              onSaveDraft={handleSaveDraft}
              onProcess={handleProcess}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
