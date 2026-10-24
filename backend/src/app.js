const path = require('path');
const express = require('express');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // behind Nginx Proxy Manager

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// health check (used by container / proxy)
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- API routes ----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/defects', require('./routes/defects'));
app.use('/api/pp-samples', require('./routes/ppSamples'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api', require('./routes/exports')); // PDF exports: /inspections/:id/pdf, /pp-samples/:id/pdf

// unknown API route -> JSON 404 (before SPA fallback)
app.use('/api', notFound);

// ---- static SPA (built frontend) ----
const publicDir = path.join(__dirname, '..', 'public');
// Vite puts content-hashed files under /assets: safe to cache for a year.
app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1y', immutable: true }));
// everything else (index.html, sw.js, manifest, icons) stays revalidated on every load
app.use(express.static(publicDir));
// client-side routing fallback
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);

module.exports = app;
