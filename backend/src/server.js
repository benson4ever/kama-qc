const config = require('./config');
const app = require('./app');
const { runMigrations } = require('./db/migrate');
const { runSeeds } = require('./db/seeds');

async function boot() {
  try {
    await runMigrations();   // additive, forward-only
    await runSeeds();        // idempotent
    app.listen(config.port, () => {
      console.log(`Kama QC backend listening on :${config.port} (${config.env})`);
    });
  } catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  }
}

boot();
