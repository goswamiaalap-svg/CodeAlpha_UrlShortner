/**
 * generateCode.js — Short-code generator
 *
 * Uses Node's built-in `crypto.randomBytes` together with a base-62 alphabet
 * to avoid any ESM-related issues with nanoid while producing URL-safe codes.
 *
 * Base-62 alphabet: a-z A-Z 0-9  →  62^7 ≈ 3.5 trillion possible codes.
 */

const crypto = require('crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 7;

/**
 * Generates a random base-62 string of CODE_LENGTH characters.
 * Uses rejection sampling to eliminate modulo bias.
 *
 * @returns {string} A 7-character alphanumeric code, e.g. "aB3xK9z"
 */
function generateCode() {
  let code = '';
  // We need CODE_LENGTH usable bytes; over-sample to account for rejections
  while (code.length < CODE_LENGTH) {
    // Generate a fresh random byte
    const byte = crypto.randomBytes(1)[0]; // 0–255
    // Reject values that would introduce bias (256 % 62 = 8, so reject ≥ 248)
    if (byte < 248) {
      code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

module.exports = { generateCode };
