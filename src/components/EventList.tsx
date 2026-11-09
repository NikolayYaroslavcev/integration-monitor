import type { IntegrationEvent } from '../../shared/types';
import { formatDay, formatRelative, formatTime } from '../format';
import { StatusBadge } from './StatusBadge';

interface Props {
  events: IntegrationEvent[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  selectedId: string | null;
  freshIds: ReadonlySet<string>;
  now: number;
  onSelect: (id: string) => void;
  filtered: boolean;
  onReset: () => void;
}

export function EventList({ events, loading, loadError, onRetry, selectedId, freshIds, now, onSelect, filtered, onReset }: Props) {
  if (loadError) {
    return (
      <div className="empty empty--error">
        <p className="empty__title">Не удалось загрузить события</p>
        <p className="empty__text">{loadError}. Проверьте, что API запущен на порту 3001.</p>
        <button type="button" className="btn" onClick={onRetry}>
          Повторить
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="list" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="row row--skeleton" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="empty">
        <p className="empty__title">{filtered ? 'Ничего не найдено' : 'Событий пока нет'}</p>
        <p className="empty__text">
          {filtered ? 'Под текущие фильтры не подходит ни одно событие.' : 'Отправьте POST /api/events, и событие появится здесь.'}
        </p>
        {filtered && (
          <button type="button" className="btn" onClick={onReset}>
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }

  const groups: { day: string; items: IntegrationEvent[] }[] = [];
  for (const e of events) {
    const day = formatDay(e.created_at, new Date(now));
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(e);
  }

  return (
    <div className="list">
      <div className="list__head" aria-hidden="true">
        <span>Статус</span>
        <span>Время</span>
        <span>Источник</span>
        <span>Тип события</span>
        <span>Описание</span>
      </div>
      {groups.map((g) => (
        <section key={g.day} className="group" aria-label={g.day}>
          <h2 className="group__day">{g.day}</h2>
          <ul className="group__items">
            {g.items.map((e) => (
              <li key={e.id}>
                <button
                  id={`row-${e.id}`}
                  type="button"
                  className={`row row--${e.status}${e.id === selectedId ? ' is-selected' : ''}${freshIds.has(e.id) ? ' is-fresh' : ''}`}
                  aria-current={e.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(e.id)}
                >
                  <span className="row__status">
                    <StatusBadge status={e.status} />
                  </span>
                  <span className="row__time">
                    <time dateTime={e.created_at}>{formatTime(e.created_at)}</time>
                    <span className="row__ago">{formatRelative(e.created_at, now)}</span>
                  </span>
                  <span className="row__source" translate="no">
                    {e.source}
                  </span>
                  <span className="row__type">
                    <code translate="no">{e.type}</code>
                  </span>
                  <span className="row__message">{e.message}</span>
                  <span className="row__chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
