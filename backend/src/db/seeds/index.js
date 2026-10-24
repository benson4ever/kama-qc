const bcrypt = require('bcryptjs');
const { pool } = require('../pool');
const config = require('../../config');
const defects = require('./defects');

// All seeds are idempotent: ON CONFLICT DO NOTHING. Re-running never
// overwrites an existing row, resets a password, or duplicates data.
// Suppliers are managed via the Admin page and are no longer seeded.
async function runSeeds() {
  console.log('[seed] seeding reference data (idempotent)...');

  // defect catalogue
  let order = 1;
  for (const d of defects) {
    await pool.query(
      `INSERT INTO defects (code, name_en, name_zh, classification, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [d.code, d.name_en, d.name_zh, d.classification, order++]
    );
  }

  // admin user — pre-hashed, seeded only if this email does not already exist.
  if (!config.admin.password) {
    console.warn(
      '[seed] ADMIN_PASSWORD is not set — skipping admin seed. ' +
      'Set ADMIN_PASSWORD in .env to seed the initial admin on first boot.'
    );
  } else {
    const hash = bcrypt.hashSync(config.admin.password, 10);
    const res = await pool.query(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [config.admin.email, config.admin.name, hash]
    );
    if (res.rowCount > 0) {
      console.log(`[seed] created initial admin user: ${config.admin.email}`);
    } else {
      console.log(`[seed] admin user ${config.admin.email} already exists — left untouched.`);
    }
  }

  console.log('[seed] done.');
}

module.exports = { runSeeds };
