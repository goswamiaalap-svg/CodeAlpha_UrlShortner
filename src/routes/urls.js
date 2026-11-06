/**
 * routes/urls.js — URL shortener route handlers
 *
 * Mounts on the Express router and handles:
 *   POST /api/shorten        — accept a long URL, return a short code
 *   GET  /api/stats/:code    — return stats for a code (bonus endpoint)
 *   GET  /:code              — redirect to the original URL (in server.js)
 */

const express     = require('express');
const rateLimit   = require('express-rate-limit');
const { generateCode }       = require('../utils/generateCode');
const {
  stmtGetByCode,
  stmtGetByUrl,
  stmtInsert,
  stmtIncrementClicks,
} = require('../db');

const router = express.Router();

// ── Rate limiter — applied only to the POST /api/shorten endpoint ─────────────
const shortenLimiter = rateLimit({
  windowMs : 15 * 60 * 1000, // 15-minute window
  max      : 30,              // max 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders  : false,
  message: {
    error: 'Too many requests. Please wait a few minutes before shortening more URLs.',
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validates that a string is a well-formed http/https URL.
 * @param {string} raw
 * @returns {{ valid: boolean, url?: URL, message?: string }}
 */
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, message: 'URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { valid: false, message: 'The provided value is not a valid URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      valid  : false,
      message: `Only http and https URLs are allowed (got "${parsed.protocol}").`,
    };
  }

  return { valid: true, url: parsed };
}

/**
 * Builds a unique short code, retrying on the (astronomically unlikely) event
 * of a collision with an existing code in the database.
 *
 * @param {number} maxAttempts
 * @returns {string}
 */
function uniqueCode(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode();
    if (!stmtGetByCode.get(code)) return code; // no collision → use it
  }
  throw new Error('Unable to generate a unique short code. Please try again.');
}

// ── POST /api/shorten ─────────────────────────────────────────────────────────
router.post('/shorten', shortenLimiter, (req, res) => {
  try {
    // 1. Validate input
    const { valid, url, message } = validateUrl(req.body?.url);
    if (!valid) {
      return res.status(400).json({ error: message });
    }

    const originalUrl = url.href; // normalised form (trailing slashes, etc.)
    const baseUrl     = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    // 2. Return existing code if the URL was already shortened
    const existing = stmtGetByUrl.get(originalUrl);
    if (existing) {
      return res.status(200).json({
        shortCode  : existing.short_code,
        shortUrl   : `${baseUrl}/${existing.short_code}`,
        originalUrl: existing.original_url,
        note       : 'This URL was already shortened.',
      });
    }

    // 3. Generate a unique code and persist the mapping
    const shortCode = uniqueCode();
    stmtInsert.run(shortCode, originalUrl);

    return res.status(201).json({
      shortCode,
      shortUrl   : `${baseUrl}/${shortCode}`,
      originalUrl,
    });
  } catch (err) {
    console.error('[POST /api/shorten]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/stats/:code ──────────────────────────────────────────────────────
router.get('/stats/:code', (req, res) => {
  try {
    const row = stmtGetByCode.get(req.params.code);
    if (!row) {
      return res.status(404).json({ error: `Code "${req.params.code}" not found.` });
    }

    return res.json({
      shortCode  : row.short_code,
      originalUrl: row.original_url,
      clicks     : row.clicks,
      createdAt  : row.created_at,
    });
  } catch (err) {
    console.error('[GET /api/stats/:code]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
