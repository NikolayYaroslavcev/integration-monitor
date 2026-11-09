import type { EventStatus } from '../../shared/types';

export const STATUS_LABEL: Record<EventStatus, string> = { success: 'Успешно', error: 'Ошибка' };

export function StatusBadge({ status, size = 'md' }: { status: EventStatus; size?: 'md' | 'lg' }) {
  return (
    <span className={`badge badge--${status} badge--${size}`}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        {status === 'success' ? (
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
      {STATUS_LABEL[status]}
    </span>
  );
}
