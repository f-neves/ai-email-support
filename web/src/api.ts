import type { AppConfig, AuthStatus, Email, Metrics } from './types';

/** Thin fetch wrapper that throws a useful Error on non-2xx responses. */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `Erro ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  getConfig: () => request<AppConfig>('/api/config'),
  getAuthStatus: () => request<AuthStatus>('/api/auth/status'),
  disconnect: () => request<{ ok: boolean }>('/api/auth/disconnect', { method: 'POST' }),

  getMetrics: () => request<Metrics>('/api/metrics'),

  getEmails: (status: string) =>
    request<{ emails: Email[]; reviewThreshold: number }>(
      `/api/emails?status=${encodeURIComponent(status)}`
    ),

  updateDraft: (id: string, draft: string) =>
    request<{ email: Email }>(`/api/emails/${id}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ draft }),
    }),

  processEmail: (id: string) =>
    request<{ email: Email }>(`/api/emails/${id}/process`, { method: 'POST' }),

  approve: (id: string, draft: string) =>
    request<{ email: Email }>(`/api/emails/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ draft }),
    }),

  discard: (id: string) =>
    request<{ email: Email }>(`/api/emails/${id}/discard`, { method: 'POST' }),

  sync: () =>
    request<{ imported: number; skipped: number; processed: number; failed: number }>(
      '/api/sync',
      { method: 'POST' }
    ),

  processPending: () =>
    request<{ processed: number; failed: number }>('/api/process-pending', { method: 'POST' }),
};
