import express, { type ErrorRequestHandler, type Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import type { ApiError, FieldError, IntegrationEvent } from '../shared/types.js';
import { createEventSchema, listQuerySchema } from './schema.js';
import { EventStore } from './store.js';

const toUtcIso = (value: string | number) => new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');

function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.flatMap((issue): FieldError[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: `Неизвестное поле «${key}»` }));
    }
    const field = issue.path.join('.') || 'body';
    const message =
      field === 'body' && issue.code === 'invalid_type' ? 'Тело запроса должно быть JSON-объектом' : issue.message;
    return [{ field, message }];
  });
}

const sendError = (res: Response, status: number, body: ApiError) => res.status(status).json(body);

export function createApp(store = new EventStore(), { staticDir }: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/events', (req, res) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendError(res, 400, {
        error: 'validation_error',
        message: 'Некорректные параметры запроса',
        fields: toFieldErrors(query.error),
      });
    }
    const { status, source, offset = 0, limit } = query.data;
    const all = store.list({ status, source });
    res.set('X-Total-Count', String(all.length));
    res.json(all.slice(offset, limit === undefined ? undefined : offset + limit));
  });

  // Server-Sent Events: every accepted event is pushed to open dashboards right away.
  app.get('/api/events/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const unsubscribe = store.subscribe((event) => {
      res.write(`event: created\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get('/api/events/:id', (req, res) => {
    const event = store.get(req.params.id);
    if (!event) return sendError(res, 404, { error: 'not_found', message: `Событие «${req.params.id}» не найдено` });
    res.json(event);
  });

  app.post('/api/events', (req, res) => {
    // An empty body is treated as {} so the client sees which fields are missing.
    const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
    if (hasBody && !req.is('application/json')) {
      return sendError(res, 415, {
        error: 'unsupported_media_type',
        message: 'Ожидается Content-Type: application/json',
      });
    }
    const parsed = createEventSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, {
        error: 'validation_error',
        message: 'Событие не добавлено: исправьте ошибки в полях',
        fields: toFieldErrors(parsed.error),
      });
    }
    const input = parsed.data;
    if (input.id && store.has(input.id)) {
      return sendError(res, 409, {
        error: 'conflict',
        message: `Событие с id «${input.id}» уже существует`,
        fields: [{ field: 'id', message: 'Такой id уже занят' }],
      });
    }
    const event: IntegrationEvent = {
      id: input.id ?? store.nextId(),
      source: input.source,
      type: input.type,
      status: input.status,
      created_at: toUtcIso(input.created_at ?? Date.now()),
      message: input.message,
      ...(input.details && { details: input.details }),
    };
    store.add(event);
    res.status(201).location(`/api/events/${encodeURIComponent(event.id)}`).json(event);
  });

  app.use('/api', (_req, res) => {
    sendError(res, 404, { error: 'not_found', message: 'Неизвестный маршрут API' });
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return sendError(res, 400, { error: 'invalid_json', message: 'Тело запроса — невалидный JSON' });
    }
    if (err?.type === 'entity.too.large') {
      return sendError(res, 413, { error: 'payload_too_large', message: 'Тело запроса больше 64 КБ' });
    }
    if (err?.status >= 400 && err.status < 500) {
      return sendError(res, err.status, { error: 'validation_error', message: 'Некорректный запрос' });
    }
    console.error(err);
    sendError(res, 500, { error: 'internal_error', message: 'Внутренняя ошибка сервера' });
  };
  app.use(onError);

  return app;
}
