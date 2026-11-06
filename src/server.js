/**
 * server.js — Express application entry point
 *
 * Responsibilities:
 *  - Load environment variables from .env
 *  - Configure middleware (JSON body parser, static file serving)
 *  - Mount API routes  → /api/*
 *  - Mount redirect    → /:code  (must come AFTER /api to avoid conflicts)
 *  - Start the HTTP server
 */

require('dotenv').config();

const express  = require('express');
const path     = require('path');
const { stmtGetByCode, stmtIncrementClicks } = require('./db');
const urlRoutes = require('./routes/urls');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

// Parse incoming JSON bodies
app.use(express.json());

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API routes ────────────────────────────────────────────────────────────────
// All API endpoints live under /api to avoid clashing with /:code
app.use('/api', urlRoutes);

// ── Redirect route ────────────────────────────────────────────────────────────
/**
 * GET /:code
 * Look up the short code, increment the click counter, then 302-redirect
 * the browser to the original URL.  Returns a 404 JSON/text response when
 * the code is unknown.
 */
app.get('/:code', (req, res) => {
  try {
    const { code } = req.params;

    // Reject obviously wrong codes early (only alphanumeric, length 7)
    if (!/^[a-zA-Z0-9]{7}$/.test(code)) {
      return res.status(404).json({ error: `Short code "${code}" not found.` });
    }

    const row = stmtGetByCode.get(code);
    if (!row) {
      return res.status(404).json({ error: `Short code "${code}" not found.` });
    }

    // Increment the click counter (synchronous, non-blocking in SQLite WAL mode)
    stmtIncrementClicks.run(code);

    // HTTP 302 — temporary redirect (browsers won't cache it aggressively)
    return res.redirect(302, row.original_url);
  } catch (err) {
    console.error('[GET /:code]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔗  URL Shortener is running`);
  console.log(`    Local:   http://localhost:${PORT}`);
  console.log(`    API:     http://localhost:${PORT}/api/shorten\n`);
});

module.exports = app; // exported for potential testing
