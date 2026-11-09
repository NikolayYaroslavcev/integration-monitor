import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { EVENT_STATUSES, type IntegrationEvent } from '../shared/types.js';

const storedEvent = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(EVENT_STATUSES),
  created_at: z.iso.datetime(),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Returns the saved events, or null when there is no usable file (first start, or a corrupt one). */
export function loadEvents(file: string): IntegrationEvent[] | null {
  if (!existsSync(file)) return null;
  try {
    return z.array(storedEvent).parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    console.warn(`Could not read ${file}, starting from seed data:`, (err as Error).message);
    return null;
  }
}

// Write to a temp file and rename, so a crash mid-write never leaves a half-written JSON behind.
export function saveEvents(file: string, events: IntegrationEvent[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(events, null, 2));
  renameSync(tmp, file);
}
