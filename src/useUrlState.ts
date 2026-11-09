import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventStatus } from '../shared/types';

export type StatusFilter = 'all' | EventStatus;

export interface UrlState {
  status: StatusFilter;
  q: string;
  source: string;
  event: string | null;
}

interface HistoryState {
  openedFrom?: string;
}

function read(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const status = p.get('status');
  return {
    status: status === 'success' || status === 'error' ? status : 'all',
    q: p.get('q') ?? '',
    source: p.get('source') ?? '',
    event: p.get('event'),
  };
}

function toUrl(state: UrlState) {
  const p = new URLSearchParams();
  if (state.status !== 'all') p.set('status', state.status);
  if (state.q) p.set('q', state.q);
  if (state.source) p.set('source', state.source);
  if (state.event) p.set('event', state.event);
  const qs = p.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

export function useUrlState() {
  const [state, setState] = useState(read);
  const ref = useRef(state);

  useEffect(() => {
    const onPop = () => {
      ref.current = read();
      setState(ref.current);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<UrlState>) => {
    const prev = ref.current;
    const next = { ...prev, ...patch };
    if (!prev.event && next.event) {
      const openedFrom = toUrl({ ...next, event: null });
      window.history.pushState({ openedFrom } satisfies HistoryState, '', toUrl(next));
    } else {
      window.history.replaceState(next.event ? window.history.state : null, '', toUrl(next));
    }
    ref.current = next;
    setState(next);
  }, []);

  const closeEvent = useCallback(() => {
    // Step back only if the previous entry is exactly the list we'd return to; otherwise filters would jump.
    const { openedFrom } = (window.history.state ?? {}) as HistoryState;
    if (openedFrom && openedFrom === toUrl({ ...ref.current, event: null })) window.history.back();
    else update({ event: null });
  }, [update]);

  return [state, update, closeEvent] as const;
}
