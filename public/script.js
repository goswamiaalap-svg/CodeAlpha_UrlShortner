/**
 * script.js — SnipURL frontend logic
 *
 * Handles:
 *  1. Form submission → POST /api/shorten
 *  2. Displaying the result or an error message
 *  3. Copy-to-clipboard functionality
 */

(function () {
  'use strict';

  // ── Element references ──────────────────────────────────────────────────────
  const form            = document.getElementById('shorten-form');
  const urlInput        = document.getElementById('url-input');
  const submitBtn       = document.getElementById('submit-btn');
  const btnText         = document.getElementById('btn-text');
  const btnSpinner      = document.getElementById('btn-spinner');
  const errorMsg        = document.getElementById('error-msg');
  const resultPanel     = document.getElementById('result-panel');
  const resultLink      = document.getElementById('result-link');
  const resultNote      = document.getElementById('result-note');
  const resultOriginal  = document.getElementById('result-original-url');
  const copyBtn         = document.getElementById('copy-btn');
  const copyText        = document.getElementById('copy-text');

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Show or hide the loading spinner on the submit button. */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    btnText.textContent = isLoading ? 'Shortening…' : 'Shorten';
    btnSpinner.classList.toggle('hidden', !isLoading);
  }

  /** Display an error message below the input. */
  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    resultPanel.classList.add('hidden');
  }

  /** Clear any visible error. */
  function clearError() {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
  }

  /**
   * Performs a lightweight URL validation on the client side before even
   * hitting the server.  The server validates authoritatively; this gives
   * instant feedback for obviously wrong values.
   *
   * @param {string} raw
   * @returns {boolean}
   */
  function isValidUrl(raw) {
    try {
      const { protocol } = new URL(raw);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ── Form submit ─────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const rawUrl = urlInput.value.trim();

    // Client-side pre-validation for immediate feedback
    if (!rawUrl) {
      showError('Please enter a URL.');
      return;
    }
    if (!isValidUrl(rawUrl)) {
      showError('Please enter a valid http or https URL (e.g. https://example.com).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/shorten', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ url: rawUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Server returned a 4xx/5xx with an error message
        showError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      // ── Render result ────────────────────────────────────────────────────────
      resultLink.href        = data.shortUrl;
      resultLink.textContent = data.shortUrl;
      resultOriginal.textContent = data.originalUrl;

      // Show "already shortened" badge when server returns 200 (not 201)
      resultNote.classList.toggle('hidden', response.status !== 200);

      resultPanel.classList.remove('hidden');

      // Reset copy button state
      copyBtn.classList.remove('copied');
      copyText.textContent = 'Copy';
    } catch (err) {
      showError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  });

  // ── Copy to clipboard ────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    const shortUrl = resultLink.textContent;
    if (!shortUrl) return;

    try {
      await navigator.clipboard.writeText(shortUrl);
      copyBtn.classList.add('copied');
      copyText.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy';
      }, 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS contexts
      const textarea = document.createElement('textarea');
      textarea.value = shortUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity  = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      copyText.textContent = 'Copied!';
      setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
    }
  });
})();
