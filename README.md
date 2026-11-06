# 🔗 SnipURL — Simple URL Shortener

A lightweight URL shortener API built with **Express.js** and **SQLite** for a backend internship task submission.

---

## Features

| Feature | Detail |
|---|---|
| **Shorten URLs** | `POST /api/shorten` accepts any valid `http`/`https` URL |
| **Redirect** | `GET /:code` increments click counter → HTTP 302 redirect |
| **Deduplication** | Same URL always returns the same short code |
| **Click stats** | `GET /api/stats/:code` returns clicks, createdAt |
| **Rate limiting** | 30 requests / 15 min per IP on the shorten endpoint |
| **Frontend** | Clean dark-mode UI with Copy-to-clipboard button |
| **No collisions** | Collision-resistant base-62 generator with retry logic |

---

## Project Structure

```
url-shortener/
├── src/
│   ├── server.js          ← Express entry point
│   ├── db.js              ← SQLite setup & prepared statements
│   ├── routes/
│   │   └── urls.js        ← POST /api/shorten, GET /api/stats/:code
│   └── utils/
│       └── generateCode.js ← crypto-based base-62 code generator
├── public/
│   ├── index.html         ← Frontend UI
│   ├── style.css
│   └── script.js
├── data/                  ← Auto-created; holds urls.db (gitignored)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Setup

### Prerequisites
- Node.js ≥ 18

### 1. Clone & install
```bash
git clone <repo-url>
cd url-shortener
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env if you need a different port or public BASE_URL
```

`.env` defaults:
```
PORT=3000
BASE_URL=http://localhost:3000
```

### 3. Start the server
```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

The server will print:
```
🔗  URL Shortener is running
    Local:   http://localhost:3000
    API:     http://localhost:3000/api/shorten
```

---

## API Documentation

### `POST /api/shorten`

Accepts a long URL and returns a unique short code.

**Request**
```bash
curl -s -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com/very/long/path?query=value"}'
```

**Response `201 Created`**
```json
{
  "shortCode": "aB3xK9z",
  "shortUrl": "http://localhost:3000/aB3xK9z",
  "originalUrl": "https://www.example.com/very/long/path?query=value"
}
```

**Response `200 OK`** (URL already shortened)
```json
{
  "shortCode": "aB3xK9z",
  "shortUrl": "http://localhost:3000/aB3xK9z",
  "originalUrl": "https://www.example.com/...",
  "note": "This URL was already shortened."
}
```

**Response `400 Bad Request`**
```json
{ "error": "Only http and https URLs are allowed (got \"ftp:\")." }
```

---

### `GET /:code`

Redirects to the original URL (HTTP 302). Click counter is incremented on every request.

```bash
curl -v http://localhost:3000/aB3xK9z
# → HTTP/1.1 302 Found
# → Location: https://www.example.com/very/long/path?query=value
```

**Response `404 Not Found`**
```json
{ "error": "Short code \"xxxxxxx\" not found." }
```

---

### `GET /api/stats/:code`

Returns metadata and click count for a given code.

```bash
curl -s http://localhost:3000/api/stats/aB3xK9z
```

**Response `200 OK`**
```json
{
  "shortCode": "aB3xK9z",
  "originalUrl": "https://www.example.com/very/long/path?query=value",
  "clicks": 5,
  "createdAt": "2024-01-15 10:23:44"
}
```

---

## Database Schema

```sql
CREATE TABLE urls (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  short_code   TEXT    UNIQUE NOT NULL,
  original_url TEXT    NOT NULL,
  clicks       INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_short_code  ON urls(short_code);
CREATE UNIQUE INDEX idx_original_url ON urls(original_url);
```

---

## How It Works

### Code Generation

Short codes are 7-character **base-62** strings (a–z, A–Z, 0–9), giving 62⁷ ≈ **3.5 trillion** possible combinations.

```
crypto.randomBytes(1) → byte (0–255)
Reject if byte ≥ 248  → eliminates modulo bias
byte % 62             → index into ALPHABET
Repeat until 7 chars collected
```

On the astronomically unlikely event of a collision (same 7 chars already in DB), the generator retries up to 10 times automatically.

### Redirect Flow

```
Browser        Server           SQLite
   │                               │
   │── GET /aB3xK9z ──────────────▶│
   │                 stmtGetByCode ─┤
   │                 stmtIncrClicks─┤
   │◀─ 302 Location: <originalUrl> ─│
   │                               │
   │── GET <originalUrl> ──────────▶ (destination server)
```

---

## Rate Limiting

The `POST /api/shorten` endpoint is protected by **express-rate-limit**:
- Window: 15 minutes
- Max requests: 30 per IP per window
- Exceeding the limit returns `429 Too Many Requests`

---

## License

MIT
