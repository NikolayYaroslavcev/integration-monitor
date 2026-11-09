import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntegrationEvent } from '../shared/types';
import { fetchEvents } from './api';

const POLL_MS = 5000;
const FRESH_MS = 4000;

const byNewest = (a: IntegrationEvent, b: IntegrationEvent) =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id, undefined, { numeric: true });

export function useEvents() {
  const [events, setEvents] = useState<IntegrationEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const known = useRef<Set<string> | null>(null);
  const requestSeq = useRef(0);

  const markFresh = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFreshIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, FRESH_MS);
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const list = await fetchEvents();
      // A newer request or a local insert happened meanwhile: this response is stale.
      if (seq !== requestSeq.current) return;
      if (known.current) markFresh(list.filter((e) => !known.current!.has(e.id)).map((e) => e.id));
      known.current = new Set(list.map((e) => e.id));
      setEvents(list);
      setError(null);
      setSyncedAt(new Date());
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Не удалось загрузить события');
    }
  }, [markFresh]);

  const addLocal = useCallback(
    (event: IntegrationEvent) => {
      requestSeq.current++;
      known.current?.add(event.id);
      setEvents((prev) => [event, ...(prev ?? []).filter((e) => e.id !== event.id)].sort(byNewest));
      markFresh([event.id]);
    },
    [markFresh],
  );

  useEffect(() => {
    void refresh();
    const tick = () => document.visibilityState === 'visible' && void refresh();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return { events, error, syncedAt, freshIds, refresh, addLocal };
}
