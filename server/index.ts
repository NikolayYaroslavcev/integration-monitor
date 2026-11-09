import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { buildSeed } from './seed.js';
import { EventStore } from './store.js';

const port = Number(process.env.PORT) || 3001;
const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

createApp(new EventStore(buildSeed()), { staticDir }).listen(port, () => {
  console.log(`API: http://localhost:${port}/api/events`);
});
