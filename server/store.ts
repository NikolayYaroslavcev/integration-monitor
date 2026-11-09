import type { IntegrationEvent, EventStatus } from '../shared/types.js';

// Capped so a flood of test POSTs can't grow memory without bound.
export class EventStore {
  private events: IntegrationEvent[];
  private seq: number;

  constructor(
    seed: IntegrationEvent[] = [],
    private readonly capacity = 1000,
  ) {
    this.events = [...seed];
    this.seq = Math.max(1000, ...seed.map((e) => Number(/^evt-(\d+)$/.exec(e.id)?.[1] ?? 0)));
  }

  list(filter: { status?: EventStatus; source?: string; limit?: number } = {}): IntegrationEvent[] {
    const source = filter.source?.toLowerCase();
    const result = this.events
      .filter((e) => !filter.status || e.status === filter.status)
      .filter((e) => !source || e.source.toLowerCase() === source)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id, undefined, { numeric: true }));
    return filter.limit ? result.slice(0, filter.limit) : result;
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
    return event;
  }
}
