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
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);

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

  // New events arrive over SSE; polling is only the fallback while the stream is down.
  useEffect(() => {
    void refresh();
    const setLiveState = (value: boolean) => {
      liveRef.current = value;
      setLive(value);
    };
    const stream = typeof EventSource === 'undefined' ? null : new EventSource('/api/events/stream');
    if (stream) {
      stream.onopen = () => {
        setLiveState(true);
        void refresh(); // catch up on anything sent while disconnected
      };
      stream.onerror = () => setLiveState(false);
      stream.addEventListener('created', (message) => {
        try {
          addLocal(JSON.parse((message as MessageEvent<string>).data) as IntegrationEvent);
          setSyncedAt(new Date());
        } catch {
          void refresh();
        }
      });
    }
    const tick = () => document.visibilityState === 'visible' && !liveRef.current && void refresh();
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stream?.close();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, addLocal]);

  return { events, error, syncedAt, live, freshIds, refresh, addLocal };
}
