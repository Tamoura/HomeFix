import { createServer, loadConfig } from './app.js';
import { openDatabase } from './db.js';
import { purgeExpiredSessions } from './auth.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);
const server = createServer({ db, config });

server.listen(config.port, config.host, () => {
  console.log(`${config.appName} is running at http://localhost:${config.port} (database: ${config.databaseFile})`);
});

const purgeTimer = setInterval(() => purgeExpiredSessions(db), 6 * 60 * 60 * 1000);
purgeTimer.unref();

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down…`);
  clearInterval(purgeTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
