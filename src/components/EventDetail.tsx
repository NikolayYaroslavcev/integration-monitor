import { useEffect, useRef } from 'react';
import type { IntegrationEvent } from '../../shared/types';
import { formatFull, formatRelative } from '../format';
import { StatusBadge } from './StatusBadge';

interface Props {
  event: IntegrationEvent | undefined;
  requestedId: string | null;
  loading: boolean;
  now: number;
  onClose: () => void;
  onCopied: (message: string) => void;
}

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);

function curlFor(e: IntegrationEvent) {
  const body = { source: e.source, type: e.type, status: e.status, message: e.message, ...(e.details && { details: e.details }) };
  return `curl -X POST ${window.location.origin}/api/events \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`;
}

export function EventDetail({ event, requestedId, loading, now, onClose, onCopied }: Props) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (requestedId && window.matchMedia('(max-width: 1023px)').matches) panelRef.current?.focus();
  }, [requestedId]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(`${what} скопирован`);
    } catch {
      onCopied('Не удалось скопировать: буфер обмена недоступен');
    }
  };

  if (!requestedId || (!event && loading)) {
    return (
      <aside className="detail detail--placeholder" aria-label="Подробности события">
        <div className="placeholder">
          <div className="placeholder__art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="placeholder__title">Выберите событие</p>
          <p className="placeholder__text">
            Здесь появятся подробности: причина ошибки, HTTP-ответ, полезная нагрузка вебхука и готовый cURL для повтора.
          </p>
        </div>
      </aside>
    );
  }

  if (!event) {
    return (
      <aside ref={panelRef} tabIndex={-1} className="detail" aria-label="Подробности события">
        <div className="detail__bar">
          <span className="detail__eyebrow">Событие</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="empty">
          <p className="empty__title">Событие не найдено</p>
          <p className="empty__text">
            <code>{requestedId}</code> нет в списке. Данные хранятся в памяти и сбрасываются при перезапуске сервера.
          </p>
        </div>
      </aside>
    );
  }

  const d = event.details ?? {};
  const isError = event.status === 'error';
  const meta: [string, string | undefined][] = [
    ['Источник', event.source],
    ['Тип события', event.type],
    ['Время', formatFull(event.created_at)],
    ['UTC', event.created_at],
    ['HTTP-код', isError ? undefined : str(d.http_status)],
    ['Длительность', d.duration_ms !== undefined ? `${str(d.duration_ms)} мс` : undefined],
    ['Попытка', isError ? undefined : str(d.attempt)],
  ];
  const json = JSON.stringify(event, null, 2);

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={`detail detail--${event.status}`}
      aria-label={`Подробности события ${event.id}`}
      key={event.id}
    >
      <div className="detail__bar">
        <button type="button" className="back-btn" onClick={onClose}>
          ‹ К списку
        </button>
        <span className="detail__eyebrow">
          Событие <code>{event.id}</code>
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть подробности">
          ×
        </button>
      </div>

      <div className="detail__body">
        <div className="detail__status">
          <StatusBadge status={event.status} size="lg" />
          <span className="detail__ago">{formatRelative(event.created_at, now)}</span>
        </div>
        <h2 className="detail__message">{event.message}</h2>

        {isError && (
          <div className="callout" role="note">
            <p className="callout__title">Событие не обработано</p>
            <p className="callout__text">
              {[str(d.http_status) && `HTTP ${str(d.http_status)}`, str(d.error_code), str(d.attempt) && `попытка ${str(d.attempt)}`]
                .filter(Boolean)
                .join(' · ') || 'Причина указана в описании выше'}
            </p>
            {str(d.hint) && <p className="callout__hint">Что сделать: {str(d.hint)}</p>}
            {str(d.next_retry_in_s) && <p className="callout__hint">Автоповтор через {str(d.next_retry_in_s)} с</p>}
          </div>
        )}

        <dl className="meta">
          {meta
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="meta__row">
                <dt>{k}</dt>
                <dd className={k === 'UTC' || k === 'Тип события' ? 'mono' : undefined}>{v}</dd>
              </div>
            ))}
        </dl>

        {d.payload !== undefined && (
          <section className="code-block">
            <h3 className="code-block__title">Полезная нагрузка</h3>
            <pre>{JSON.stringify(d.payload, null, 2)}</pre>
          </section>
        )}

        <section className="code-block">
          <div className="code-block__head">
            <h3 className="code-block__title">JSON события</h3>
            <button type="button" className="link-btn" onClick={() => void copy(json, 'JSON')}>
              Копировать
            </button>
          </div>
          <pre>{json}</pre>
        </section>

        <div className="detail__actions">
          <button type="button" className="btn" onClick={() => void copy(event.id, 'ID')}>
            Копировать ID
          </button>
          <button type="button" className="btn" onClick={() => void copy(curlFor(event), 'cURL')}>
            Копировать cURL для повтора
          </button>
        </div>
      </div>
    </aside>
  );
}
