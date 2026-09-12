// Vercel serverless entry point. vercel.json routes every request here; the
// files in /public are served by Vercel's CDN before this function runs.
//
// Vercel functions have no persistent disk, so the SQLite database lives in
// /tmp and demo data is seeded on every cold start (see loadConfig).

import { createApp, loadConfig } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { seedDemoData } from '../scripts/seed.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);
if (config.demoMode) seedDemoData(db, config);
const app = createApp({ db, config });

export default function handler(req, res) {
  return app.handle(req, res);
}
