import type { ApiError, FieldError, IntegrationEvent } from '../shared/types';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: FieldError[] = [],
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiError | null;
    throw new ApiRequestError(err?.message ?? `Ошибка сервера (${res.status})`, res.status, err?.fields);
  }
  return body as T;
}

export async function fetchEvents(signal?: AbortSignal): Promise<IntegrationEvent[]> {
  return parse(await fetch('/api/events', { signal }));
}

export async function createEvent(body: unknown): Promise<IntegrationEvent> {
  return parse(
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
