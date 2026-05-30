// Shared domain types used across the AI pipeline and routes.

export const CATEGORIES = [
  'duvida',
  'reclamacao',
  'elogio',
  'suporte_tecnico',
  'financeiro',
  'outro',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ['baixa', 'media', 'alta'] as const;
export type Urgency = (typeof URGENCIES)[number];

export interface Classification {
  categoria: Category;
  urgencia: Urgency;
  idioma: string; // ISO-ish language code (pt, en, es, ...)
  resumo: string;
}

export interface DraftResult {
  resposta: string;
  confianca: number; // clamped to [0, 1]
}

/** Minimal shape the AI pipeline needs from an email. */
export interface EmailInput {
  sender: string;
  subject: string;
  body: string;
}
