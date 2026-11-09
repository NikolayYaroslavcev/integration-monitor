import type { StatusFilter, UrlState } from '../useUrlState';

interface Props {
  status: StatusFilter;
  counts: Record<StatusFilter, number>;
  q: string;
  source: string;
  sources: string[];
  onChange: (patch: Partial<UrlState>) => void;
}

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'success', label: 'Успешно' },
  { key: 'error', label: 'Ошибка' },
];

export function Toolbar({ status, counts, q, source, sources, onChange }: Props) {
  return (
    <div className="toolbar">
      <div className="segmented" role="radiogroup" aria-label="Фильтр по статусу">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={status === t.key}
            className={`segmented__item segmented__item--${t.key}${status === t.key ? ' is-active' : ''}`}
            onClick={() => onChange({ status: t.key })}
          >
            {t.label}
            <span className="segmented__count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar__fields">
        <label className="search">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Поиск</span>
          <input
            type="search"
            value={q}
            placeholder="Поиск: id, тип, текст…"
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </label>
        <label className="select">
          <span className="sr-only">Источник</span>
          <select value={source} onChange={(e) => onChange({ source: e.target.value })}>
            <option value="">Все источники</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
