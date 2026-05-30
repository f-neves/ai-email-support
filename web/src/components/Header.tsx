import type { AppConfig, AuthStatus } from '../types';

interface Props {
  config: AppConfig | null;
  auth: AuthStatus | null;
  busy: boolean;
  onSync: () => void;
  onProcessPending: () => void;
  onDisconnect: () => void;
}

export function Header({ config, auth, busy, onSync, onProcessPending, onDisconnect }: Props) {
  const gmailConfigured = config?.googleConfigured ?? false;
  const connected = auth?.connected ?? false;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-900">
              AI Email Support
            </h1>
            <p className="text-xs text-slate-400">
              {config?.companyName ?? 'Suporte'} · revisão assistida por IA
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* AI status pill */}
          <span
            className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
              config?.anthropicConfigured
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
            title={
              config?.anthropicConfigured
                ? 'Chave Anthropic configurada'
                : 'ANTHROPIC_API_KEY ausente — IA desabilitada'
            }
          >
            ● IA {config?.anthropicConfigured ? 'pronta' : 'sem chave'}
          </span>

          <button
            onClick={onProcessPending}
            disabled={busy || !config?.anthropicConfigured}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Classifica e gera rascunhos para os e-mails ainda não processados"
          >
            Processar pendentes
          </button>

          {/* Gmail controls */}
          {gmailConfigured && connected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onSync}
                disabled={busy}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Sincronizando…' : '↻ Sincronizar Gmail'}
              </button>
              <button
                onClick={onDisconnect}
                title={auth?.email ? `Conectado: ${auth.email}` : 'Desconectar Gmail'}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-rose-600"
              >
                Desconectar
              </button>
            </div>
          ) : gmailConfigured ? (
            <a
              href="/api/auth/google"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Conectar Gmail
            </a>
          ) : (
            <span
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400"
              title="Configure GOOGLE_CLIENT_ID / SECRET no .env para habilitar o Gmail"
            >
              Gmail não configurado
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
