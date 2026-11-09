import type { StatusFilter, UrlState } from '../useUrlState';
import { SourceSelect, type SourceOption } from './SourceSelect';

type FilterPatch = Partial<Pick<UrlState, 'status' | 'q' | 'source'>>;

interface Props {
  status: StatusFilter;
  counts: Record<StatusFilter, number>;
  q: string;
  source: string;
  sources: SourceOption[];
  onChange: (patch: FilterPatch) => void;
}

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'success', label: 'Успешно' },
  { key: 'error', label: 'Ошибка' },
];

export function Toolbar({ status, counts, q, source, sources, onChange }: Props) {
  return (
    <div className="toolbar">
      <div className="segmented" role="group" aria-label="Фильтр по статусу">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={status === t.key}
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
        <SourceSelect value={source} options={sources} onChange={(value) => onChange({ source: value })} />
      </div>
    </div>
  );
}
