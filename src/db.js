/**
 * db.js — Database initialisation module
 *
 * Opens (or creates) the SQLite database at data/urls.db, runs the schema
 * migration on first launch, and exports the prepared statements used by
 * the route handlers.
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Ensure the data/ directory exists ────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'urls.db');

// Open the database (creates the file if it doesn't exist)
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent-read performance
db.pragma('journal_mode = WAL');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code   TEXT    UNIQUE NOT NULL,
    original_url TEXT    NOT NULL,
    clicks       INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Fast look-ups by short code
  CREATE INDEX IF NOT EXISTS idx_short_code ON urls(short_code);

  -- Prevents duplicate rows for the same original URL
  CREATE UNIQUE INDEX IF NOT EXISTS idx_original_url ON urls(original_url);
`);

// ── Prepared statements (compiled once, reused on every request) ─────────────

/** Check whether a short_code already exists. */
const stmtGetByCode = db.prepare(
  `SELECT id, short_code, original_url, clicks, created_at
   FROM urls WHERE short_code = ?`
);

/** Check whether we already shortened a given original URL. */
const stmtGetByUrl = db.prepare(
  `SELECT id, short_code, original_url, clicks, created_at
   FROM urls WHERE original_url = ?`
);

/** Insert a new mapping. */
const stmtInsert = db.prepare(
  `INSERT INTO urls (short_code, original_url) VALUES (?, ?)`
);

/** Atomically increment the click counter and return the updated row. */
const stmtIncrementClicks = db.prepare(
  `UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?`
);

module.exports = {
  db,
  stmtGetByCode,
  stmtGetByUrl,
  stmtInsert,
  stmtIncrementClicks,
};
