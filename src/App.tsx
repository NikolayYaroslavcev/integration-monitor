import { useEffect, useMemo, useState } from 'react';
import type { IntegrationEvent } from '../shared/types';
import { EventDetail } from './components/EventDetail';
import { EventList } from './components/EventList';
import { NewEventDialog } from './components/NewEventDialog';
import { ThemeToggle } from './components/ThemeToggle';
import type { SourceOption } from './components/SourceSelect';
import { StatsPanel } from './components/StatsPanel';
import { Toolbar } from './components/Toolbar';
import { formatTime } from './format';
import { useEvents } from './useEvents';
import { useUrlState, type UrlState } from './useUrlState';

function matches(e: IntegrationEvent, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [e.id, e.source, e.type, e.message].some((v) => v.toLowerCase().includes(needle));
}

export function App() {
  const { events, error, syncedAt, freshIds, refresh, addLocal } = useEvents();
  const [url, setUrl, closeEvent] = useUrlState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const all = events ?? [];
  const sourceStats = useMemo(() => {
    const map = new Map<string, SourceOption>();
    for (const e of all) {
      const s = map.get(e.source) ?? { name: e.source, total: 0, errors: 0 };
      s.total++;
      if (e.status === 'error') s.errors++;
      map.set(e.source, s);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const sources = useMemo(() => sourceStats.map((s) => s.name), [sourceStats]);

  const scoped = useMemo(
    () => all.filter((e) => (!url.source || e.source === url.source) && matches(e, url.q.trim())),
    [all, url.source, url.q],
  );
  const visible = useMemo(
    () => (url.status === 'all' ? scoped : scoped.filter((e) => e.status === url.status)),
    [scoped, url.status],
  );
  const scopeCounts = useMemo(
    () => ({
      all: scoped.length,
      success: scoped.filter((e) => e.status === 'success').length,
      error: scoped.filter((e) => e.status === 'error').length,
    }),
    [scoped],
  );

  const selected = url.event ? all.find((e) => e.id === url.event) : undefined;

  // Changing a filter closes details if the opened event would no longer be in the list.
  const setFilter = (patch: Partial<Pick<UrlState, 'status' | 'q' | 'source'>>) => {
    const next = { ...url, ...patch };
    const stillVisible =
      selected &&
      (next.status === 'all' || selected.status === next.status) &&
      (!next.source || selected.source === next.source) &&
      matches(selected, next.q.trim());
    setUrl(stillVisible || !url.event ? patch : { ...patch, event: null });
  };
  const select = (id: string) => setUrl({ event: id });

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (dialogOpen || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (ev.key === 'Escape' && url.event) return closeEvent();
      // Arrows only when focus isn't on some other widget, so page/JSON scrolling and radio groups keep working.
      const arrowsAllowed = target === document.body || !!target.closest('.list');
      const down = ev.key === 'j' || (arrowsAllowed && ev.key === 'ArrowDown');
      const up = ev.key === 'k' || (arrowsAllowed && ev.key === 'ArrowUp');
      const step = down ? 1 : up ? -1 : 0;
      if (!step || !visible.length) return;
      ev.preventDefault();
      const idx = visible.findIndex((e) => e.id === url.event);
      const next = visible[Math.min(visible.length - 1, Math.max(0, idx === -1 ? 0 : idx + step))];
      setUrl({ event: next.id });
      document.getElementById(`row-${next.id}`)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, url.event, dialogOpen, setUrl, closeEvent]);

  const hasScope = Boolean(url.q || url.source || url.status !== 'all');

  return (
    <div className={`app${url.event ? ' app--detail' : ''}`}>
      <a className="skip-link" href="#events">
        К списку событий
      </a>
      <header className="topbar">
        <div className="brand">
          <span className={`brand__mark${error ? ' is-down' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M2 13h4l2.5-6 4 11 3-8 2 3H22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="brand__name">Пульс интеграций</h1>
            <p className="brand__sub">Вебхуки CRM и сервисов</p>
          </div>
        </div>
        <div className="topbar__actions">
          <ThemeToggle />
          <button
            type="button"
            className={`sync${error ? ' sync--down' : ''}`}
            onClick={() => void refresh()}
            title="Обновить сейчас (автообновление каждые 5 с)"
          >
            <span className="sync__dot" aria-hidden="true" />
            <span className="sync__label">
              {error ? 'Нет связи с API' : syncedAt ? `Обновлено в ${formatTime(syncedAt.toISOString())}` : 'Подключение…'}
            </span>
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setDialogOpen(true)} aria-label="Добавить тестовое событие">
            <span aria-hidden="true">+</span>
            <span className="btn__long">Тестовое событие</span>
            <span className="btn__short">Событие</span>
          </button>
        </div>
      </header>

      <StatsPanel
        events={all}
        loading={!events}
        status={url.status}
        selectedId={url.event}
        onStatus={(status) => setFilter({ status })}
        onSelect={select}
      />

      <main className="workspace">
        <section id="events" className="feed" aria-label="Список событий" tabIndex={-1}>
          <Toolbar
            status={url.status}
            counts={scopeCounts}
            q={url.q}
            source={url.source}
            sources={sourceStats}
            onChange={setFilter}
          />
          <EventList
            events={visible}
            loading={!events}
            loadError={events ? null : error}
            onRetry={() => void refresh()}
            selectedId={url.event}
            freshIds={freshIds}
            now={now}
            onSelect={select}
            filtered={hasScope}
            onReset={() => setUrl({ status: 'all', q: '', source: '' })}
          />
          <p className="hint" aria-hidden="true">
            <kbd>↑</kbd> <kbd>↓</kbd> — переход по событиям, <kbd>Esc</kbd> — закрыть подробности
          </p>
        </section>

        {url.event && (
          <button type="button" className="sheet-backdrop" aria-label="Закрыть подробности" onClick={closeEvent} />
        )}
        <EventDetail
          event={selected}
          requestedId={url.event}
          loading={!events}
          now={now}
          onClose={closeEvent}
          onCopied={setToast}
        />
      </main>

      <NewEventDialog
        open={dialogOpen}
        sources={sources}
        onClose={() => setDialogOpen(false)}
        onCreated={(event) => {
          addLocal(event);
          setDialogOpen(false);
          setUrl({ status: 'all', q: '', source: '', event: event.id });
          setToast(`Событие ${event.id} добавлено`);
        }}
      />

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
