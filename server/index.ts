import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadEvents, saveEvents } from './persistence.js';
import { buildSeed } from './seed.js';
import { EventStore } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3001;
// DATA_FILE="" keeps everything in memory (used by the e2e tests).
const dataFile = process.env.DATA_FILE ?? path.join(root, 'data', 'events.json');

const saved = dataFile ? loadEvents(dataFile) : null;
const store = new EventStore(saved ?? buildSeed());
if (dataFile) {
  if (!saved) saveEvents(dataFile, store.list());
  store.subscribe(() => saveEvents(dataFile, store.list()));
}

createApp(store, { staticDir: path.join(root, 'dist') }).listen(port, () => {
  console.log(`API: http://localhost:${port}/api/events`);
  console.log(dataFile ? `Data file: ${dataFile}` : 'Data: in memory only');
});
