import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { buildSeed } from '../server/seed.js';
import { EventStore } from '../server/store.js';
import type { IntegrationEvent } from '../shared/types.js';

const valid = {
  source: 'amoCRM',
  type: 'lead.created',
  status: 'success',
  message: 'Заявка успешно передана',
};

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(new EventStore(buildSeed()));
});

describe('GET /api/events', () => {
  it('returns at least 8 seed events of both statuses, newest first', async () => {
    const res = await request(app).get('/api/events').expect(200);
    const events = res.body as IntegrationEvent[];
    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(new Set(events.map((e) => e.status))).toEqual(new Set(['success', 'error']));
    const times = events.map((e) => e.created_at);
    expect([...times].sort().reverse()).toEqual(times);
    for (const e of events.filter((e) => e.status === 'error')) expect(e.message.length).toBeGreaterThan(10);
  });

  it('filters by status and source', async () => {
    const errors = (await request(app).get('/api/events?status=error').expect(200)).body as IntegrationEvent[];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.status === 'error')).toBe(true);
    const amo = (await request(app).get('/api/events?source=amocrm').expect(200)).body as IntegrationEvent[];
    expect(amo.length).toBeGreaterThan(0);
    expect(amo.every((e) => e.source === 'amoCRM')).toBe(true);
  });

  it('rejects an unknown status filter', async () => {
    const res = await request(app).get('/api/events?status=pending').expect(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns a single event and 404 for a missing one', async () => {
    await request(app).get('/api/events/evt-1001').expect(200);
    const res = await request(app).get('/api/events/nope').expect(404);
    expect(res.body.error).toBe('not_found');
  });
});

describe('POST /api/events', () => {
  it('creates an event that then appears first in the list', async () => {
    const res = await request(app).post('/api/events').send(valid).expect(201);
    expect(res.body).toMatchObject(valid);
    expect(res.body.id).toMatch(/^evt-\d+$/);
    expect(res.headers.location).toBe(`/api/events/${res.body.id}`);
    const list = (await request(app).get('/api/events')).body as IntegrationEvent[];
    expect(list[0].id).toBe(res.body.id);
  });

  it('keeps client id, normalizes created_at to UTC and stores details', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ ...valid, id: 'evt-9001', created_at: '2026-11-02T15:15:00+03:00', status: 'error', details: { http_status: 500 } })
      .expect(201);
    expect(res.body).toMatchObject({ id: 'evt-9001', created_at: '2026-11-02T12:15:00Z', details: { http_status: 500 } });
  });

  it('returns 400 with per-field errors when required fields are missing', async () => {
    const before = (await request(app).get('/api/events')).body.length;
    const res = await request(app).post('/api/events').send({ source: 'amoCRM' }).expect(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['message', 'status', 'type']);
    expect((await request(app).get('/api/events')).body.length).toBe(before);
  });

  it.each([
    [{ ...valid, status: 'ok' }, 'status'],
    [{ ...valid, message: '   ' }, 'message'],
    [{ ...valid, source: 42 }, 'source'],
    [{ ...valid, created_at: 'вчера' }, 'created_at'],
    [{ ...valid, created_at: '9999-12-31T00:00:00Z' }, 'created_at'],
    [{ ...valid, created_at: '0001-01-01T00:00:00+14:00' }, 'created_at'],
    [{ ...valid, id: 'evt 1' }, 'id'],
    [{ ...valid, details: 'text' }, 'details'],
    [{ ...valid, staus: 'error' }, 'staus'],
  ])('rejects invalid field %#', async (body, field) => {
    const res = await request(app).post('/api/events').send(body).expect(400);
    expect(res.body.fields.map((f: { field: string }) => f.field)).toContain(field);
  });

  it('rejects malformed JSON, non-object bodies and wrong content type', async () => {
    const bad = await request(app).post('/api/events').set('Content-Type', 'application/json').send('{"source":').expect(400);
    expect(bad.body.error).toBe('invalid_json');
    await request(app).post('/api/events').send([valid]).expect(400);
    await request(app).post('/api/events').set('Content-Type', 'text/plain').send('hello').expect(415);
  });

  it('treats an empty POST as an object with missing fields, not as a content-type error', async () => {
    const res = await request(app).post('/api/events').expect(400);
    expect(res.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['message', 'source', 'status', 'type']);
  });

  it('maps client errors from body parsing and routing to 4xx, not 500', async () => {
    await request(app).get('/api/events/%E0%A4%A').expect(400);
  });

  it('never evicts the event it just accepted when the store is full', async () => {
    const small = createApp(new EventStore(buildSeed(), 12));
    const res = await request(small)
      .post('/api/events')
      .send({ ...valid, id: 'old-one', created_at: '2001-01-01T00:00:00Z' })
      .expect(201);
    await request(small).get(`/api/events/${res.body.id}`).expect(200);
    expect((await request(small).get('/api/events')).body).toHaveLength(12);
  });

  it('returns 409 for a duplicate id', async () => {
    const res = await request(app).post('/api/events').send({ ...valid, id: 'evt-1001' }).expect(409);
    expect(res.body.error).toBe('conflict');
  });
});
