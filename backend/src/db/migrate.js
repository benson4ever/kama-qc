const path = require('path');
const config = require('../config');

// node-pg-migrate ships as an ESM module with a default export; handle CJS interop.
const runnerModule = require('node-pg-migrate');
const migrationRunner = runnerModule.default || runnerModule;

// Forward-only, additive migrations. Runs every boot; already-applied
// migrations are skipped. Never rolls back automatically.
async function runMigrations() {
  console.log('[migrate] applying pending migrations...');
  await migrationRunner({
    databaseUrl: config.databaseUrl,
    dir: path.join(__dirname, 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    ignorePattern: '.*\\.map',
    log: (msg) => console.log('[migrate]', msg),
  });
  console.log('[migrate] migrations up to date.');
}

module.exports = { runMigrations };
