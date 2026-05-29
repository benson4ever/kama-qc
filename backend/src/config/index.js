const path = require('path');
require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim(),
    name: process.env.ADMIN_NAME || 'Administrator',
    password: process.env.ADMIN_PASSWORD || '',
  },
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'),
  nextcloud: {
    url: (process.env.NEXTCLOUD_URL || '').replace(/\/+$/, ''),
    user: process.env.NEXTCLOUD_USER || '',
    password: process.env.NEXTCLOUD_PASSWORD || '',
    get enabled() {
      return Boolean(this.url && this.user && this.password);
    },
  },
};

config.databaseUrl =
  `postgres://${encodeURIComponent(config.db.user)}:` +
  `${encodeURIComponent(config.db.password)}@${config.db.host}:` +
  `${config.db.port}/${config.db.database}`;

module.exports = config;
