import type { IntegrationEvent } from '../../shared/types';
import { formatFull, formatTime, plural } from '../format';
import type { StatusFilter } from '../useUrlState';
import { STATUS_LABEL } from './StatusBadge';

interface Props {
  events: IntegrationEvent[];
  loading: boolean;
  status: StatusFilter;
  selectedId: string | null;
  onStatus: (s: StatusFilter) => void;
  onSelect: (id: string) => void;
}

const PULSE_LIMIT = 40;

export function StatsPanel({ events, loading, status, selectedId, onStatus, onSelect }: Props) {
  const total = events.length;
  const ok = events.filter((e) => e.status === 'success').length;
  const failed = total - ok;
  const rate = total ? Math.round((ok / total) * 100) : 0;
  const sourceCount = new Set(events.map((e) => e.source)).size;
  const pulse = events.slice(0, PULSE_LIMIT).reverse();

  const cards: { key: StatusFilter; label: string; value: number; note: string }[] = [
    {
      key: 'all',
      label: 'Всего событий',
      value: total,
      note: total ? `из ${sourceCount} ${plural(sourceCount, ['источника', 'источников', 'источников'])}` : 'Пока пусто',
    },
    { key: 'success', label: 'Успешно', value: ok, note: total ? `${rate}% от всех` : '—' },
    {
      key: 'error',
      label: 'С ошибкой',
      value: failed,
      note: failed ? `${failed} ${plural(failed, ['требует', 'требуют', 'требуют'])} внимания` : 'Всё чисто',
    },
  ];

  return (
    <section className="stats" aria-label="Статистика">
      <div className="stats__cards">
        {cards.map((c, i) => (
          <button
            key={c.key}
            type="button"
            className={`stat stat--${c.key}${status === c.key ? ' is-active' : ''}`}
            style={{ animationDelay: `${i * 70}ms` }}
            aria-pressed={status === c.key}
            onClick={() => onStatus(c.key)}
            title={`Показать: ${c.key === 'all' ? 'все события' : STATUS_LABEL[c.key].toLowerCase()}`}
          >
            <span className="stat__label">{c.label}</span>
            <span className="stat__value">{loading ? '–' : c.value}</span>
            <span className="stat__note">{loading ? 'Загрузка…' : c.note}</span>
            {c.key === 'all' && !loading && total > 0 && (
              <span className="stat__meter" aria-hidden="true">
                <span style={{ transform: `scaleX(${rate / 100})` }} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="pulse" style={{ animationDelay: '210ms' }}>
        <div className="pulse__head">
          <span className="pulse__title">
            Лента активности <span className="pulse__count">· последние {pulse.length}</span>
          </span>
          <span className="pulse__legend">
            <i className="dot dot--success" /> успех <i className="dot dot--error" /> ошибка
          </span>
        </div>
        <div className={`pulse__track${pulse.some((e) => e.id === selectedId) ? ' has-selection' : ''}`} role="list" aria-label={`Последние ${pulse.length} событий по времени`}>
          {pulse.map((e) => (
            <button
              key={e.id}
              type="button"
              role="listitem"
              className={`tick tick--${e.status}${e.id === selectedId ? ' is-selected' : ''}`}
              title={`${formatFull(e.created_at)} · ${e.source} · ${e.type}`}
              aria-label={`${e.id}, ${STATUS_LABEL[e.status]}, ${e.source}, ${formatTime(e.created_at)}`}
              onClick={() => onSelect(e.id)}
            />
          ))}
          {loading && <span className="pulse__empty">Загрузка…</span>}
        </div>
        {pulse.length > 1 && (
          <div className="pulse__axis">
            <span>{formatTime(pulse[0].created_at)}</span>
            <span>по порядку поступления</span>
            <span>{formatTime(pulse[pulse.length - 1].created_at)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
