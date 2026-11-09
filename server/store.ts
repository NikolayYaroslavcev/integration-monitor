import type { IntegrationEvent, EventStatus } from '../shared/types.js';

type Listener = (event: IntegrationEvent) => void;

const byNewest = (a: IntegrationEvent, b: IntegrationEvent) =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id, undefined, { numeric: true });

// Capped so a flood of test POSTs can't grow memory without bound.
export class EventStore {
  private events: IntegrationEvent[];
  private seq: number;
  private readonly listeners = new Set<Listener>();

  constructor(
    seed: IntegrationEvent[] = [],
    private readonly capacity = 1000,
  ) {
    this.events = [...seed].sort(byNewest).slice(0, capacity);
    this.seq = Math.max(1000, ...this.events.map((e) => Number(/^evt-(\d+)$/.exec(e.id)?.[1] ?? 0)));
  }

  list(filter: { status?: EventStatus; source?: string } = {}): IntegrationEvent[] {
    const source = filter.source?.toLowerCase();
    return this.events
      .filter((e) => !filter.status || e.status === filter.status)
      .filter((e) => !source || e.source.toLowerCase() === source)
      .sort(byNewest);
  }

  get(id: string): IntegrationEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  has(id: string): boolean {
    return this.events.some((e) => e.id === id);
  }

  nextId(): string {
    let id: string;
    do id = `evt-${++this.seq}`;
    while (this.has(id));
    return id;
  }

  add(event: IntegrationEvent): IntegrationEvent {
    // When full, evict the oldest of the existing events, never the one just accepted.
    const kept = this.events.length >= this.capacity ? this.list().slice(0, this.capacity - 1) : this.events;
    this.events = [...kept, event];
    this.listeners.forEach((listener) => listener(event));
    return event;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
