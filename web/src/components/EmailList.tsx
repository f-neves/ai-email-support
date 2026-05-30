import type { Email } from '../types';
import {
  CategoryBadge,
  ConfidenceMeter,
  ReviewBadge,
  StatusBadge,
  UrgencyBadge,
} from './Badges';

interface Props {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  reviewThreshold: number;
  loading: boolean;
}

/** Extracts a friendly display name from a "Name <addr>" sender header. */
function senderName(sender: string): string {
  const match = sender.match(/^\s*"?([^"<]+?)"?\s*</);
  return (match ? match[1] : sender).trim();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

function SkeletonRow() {
  return (
    <div className="animate-pulse border-b border-slate-100 px-4 py-4">
      <div className="mb-2 h-3 w-1/3 rounded bg-slate-200" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
    </div>
  );
}

export function EmailList({ emails, selectedId, onSelect, reviewThreshold, loading }: Props) {
  if (loading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <div className="text-4xl">📭</div>
        <p className="font-medium text-slate-600">Nenhum e-mail por aqui</p>
        <p className="max-w-xs text-sm text-slate-400">
          Rode o seed para ver exemplos, ou sincronize sua caixa do Gmail.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {emails.map((email) => {
        const needsReview =
          email.confidence !== null && email.confidence < reviewThreshold && email.status !== 'sent';
        const isSelected = email.id === selectedId;
        return (
          <li key={email.id}>
            <button
              onClick={() => onSelect(email)}
              className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors ${
                isSelected ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-800">
                  {senderName(email.sender)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(email.receivedAt)}</span>
              </div>
              <span className="truncate text-sm text-slate-600">{email.subject}</span>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <CategoryBadge value={email.category} />
                <UrgencyBadge value={email.urgency} />
                <StatusBadge value={email.status} />
                {needsReview && <ReviewBadge />}
                {email.language && email.language !== 'pt' && (
                  <span className="text-xs uppercase text-slate-400">{email.language}</span>
                )}
              </div>
              <div className="pt-0.5">
                <ConfidenceMeter value={email.confidence} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
