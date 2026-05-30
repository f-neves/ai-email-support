export interface Email {
  id: string;
  gmailId: string | null;
  threadId: string | null;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  category: string | null;
  urgency: string | null;
  language: string | null;
  summary: string | null;
  draft: string | null;
  confidence: number | null;
  status: 'pending' | 'reviewed' | 'sent' | 'discarded';
  autoSent: boolean;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  anthropicConfigured: boolean;
  googleConfigured: boolean;
  reviewThreshold: number;
  autoSendEnabled: boolean;
  autoSendThreshold: number;
  companyName: string;
  gmailLabel: string;
}

export interface AuthStatus {
  connected: boolean;
  email: string | null;
  configured: boolean;
}

export interface Metrics {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  sent: number;
  autoSent: number;
  autoResolutionRate: number;
  avgConfidence: number | null;
  avgResolutionHours: number | null;
}
