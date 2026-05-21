# OddSwitch Integration Guide for Betting Platforms

Complete documentation for integrating the OddSwitch Engine into your betting platform to enable cross-bookmaker booking code translation for your users.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Integration Methods](#integration-methods)
5. [API Reference](#api-reference)
6. [Authentication](#authentication)
7. [Implementation Guide](#implementation-guide)
8. [Frontend Integration](#frontend-integration)
9. [Webhook Handling](#webhook-handling)
10. [Error Handling](#error-handling)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Overview

OddSwitch is a distributed async service that translates booking codes between sports bookmakers. When a user has a booking code from one bookmaker (e.g., SportyBet) but wants to place the same bet on another (e.g., Bet9ja), OddSwitch handles the translation.

### What OddSwitch Does

1. **Resolves** the source booking code to extract bet selections
2. **Normalizes** the data into a canonical, bookmaker-agnostic format
3. **Matches** events across bookmakers using fuzzy logic and learned mappings
4. **Translates** markets and selections to target bookmaker equivalents
5. **Generates** a new booking code on the target bookmaker
6. **Returns** the translated code with confidence scores

### Supported Bookmakers

| Bookmaker | Code Resolution | Code Generation | Status |
|-----------|----------------|-----------------|--------|
| SportyBet | ✅ | ✅ | Production Ready |
| Bet9ja | ✅ | ✅ | Production Ready |

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Platform │────▶│  OddSwitch API  │────▶│  Celery Worker  │
│   (Frontend)    │     │   (FastAPI)     │     │  (Translation)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
         │                                                │
         │         ┌──────────────┐                     │
         └────────▶│  PostgreSQL  │◀────────────────────┘
                   │  (Jobs/Logs) │
                   └──────────────┘
                          │
                   ┌──────────────┐
                   │    Redis     │◀── Cache/Dedup/Rate Limit
                   └──────────────┘
                          │
                   ┌──────────────┐
                   │Browser Worker│◀── Playwright Automation
                   └──────────────┘
```

### Data Flow

1. Your platform sends a `POST /v1/translate` request
2. OddSwitch returns immediately with a `job_id` (202 Accepted)
3. Your platform polls `GET /v1/translate/{job_id}` or receives a webhook callback
4. Translation completes (typically 10-60 seconds depending on complexity)

---

## Prerequisites

### For Self-Hosted Integration

- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+
- 4GB+ RAM (8GB recommended for browser workers)
- System Chrome installed (for Bet9ja support)

### For API Integration (If OddSwitch is hosted for you)

- API key (provided by your OddSwitch administrator)
- HTTPS endpoint capable of receiving webhooks (optional)

---

## Integration Methods

### Method 1: Direct API Integration (Recommended)

Your backend server communicates directly with OddSwitch API.

**Pros:**
- Full control over API keys
- Can cache results server-side
- Better error handling

**Cons:**
- Requires backend development

### Method 2: Frontend-First Integration

Your frontend calls OddSwitch directly (CORS-enabled).

**Pros:**
- Faster implementation
- No backend changes needed

**Cons:**
- API key exposure risk (use restricted keys)
- Less control over caching

---

## API Reference

### Base URL

```
Development: http://localhost:8000
Production:  https://your-oddswitch-domain.com
```

### Endpoints

#### 1. Create Translation Job

```http
POST /v1/translate
Content-Type: application/json
X-API-Key: your-api-key
```

**Request Body:**

```json
{
  "source_bookmaker": "sportybet",
  "target_bookmaker": "bet9ja",
  "booking_code": "ABC123XYZ",
  "callback_url": "https://yourplatform.com/webhook/oddswitch"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_bookmaker` | string | Yes | Source bookmaker ID (e.g., "sportybet", "bet9ja") |
| `target_bookmaker` | string | Yes | Target bookmaker ID |
| `booking_code` | string | Yes | The booking code to translate |
| `callback_url` | string | No | Webhook URL for async notification |

**Response (202 Accepted):**

```json
{
  "job_id": "01HXZ...",
  "status": "queued"
}
```

Or if cached (immediate):

```json
{
  "job_id": "01HXZ...",
  "status": "completed",
  "result": { /* translation result */ }
}
```

---

#### 2. Check Job Status

```http
GET /v1/translate/{job_id}
X-API-Key: your-api-key
```

**Response (Pending):**

```json
{
  "job_id": "01HXZ...",
  "status": "processing",
  "result": null,
  "error": null
}
```

**Response (Completed):**

```json
{
  "job_id": "01HXZ...",
  "status": "completed",
  "result": {
    "translated_code": "5CJJLLH",
    "confidence": 0.95,
    "status": "semantically_equivalent",
    "source_odds": 15.5,
    "target_odds": 14.2,
    "odds_delta": -1.3,
    "legs": [
      {
        "event": "Arsenal vs Chelsea",
        "market": "Match Winner",
        "selection": "Arsenal",
        "source_odds": 2.1,
        "target_odds": 2.05,
        "confidence": 0.98,
        "status": "exact"
      }
    ]
  },
  "error": null
}
```

**Response (Failed):**

```json
{
  "job_id": "01HXZ...",
  "status": "failed",
  "result": null,
  "error": {
    "code": "TRANSLATION_FAILED",
    "message": "Unable to resolve booking code on source bookmaker"
  }
}
```

---

#### 3. Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "services": {
    "postgres": true,
    "redis": true
  }
}
```

---

### Confidence Levels

The `status` field in the result indicates translation quality:

| Status | Confidence | Meaning | User Action |
|--------|------------|---------|-------------|
| `semantically_equivalent` | > 0.9 | Perfect match | Safe to use |
| `approximate` | 0.7 - 0.9 | Close match, minor differences | Show warning |
| `partial` | < 0.7 | Significant discrepancies | Recommend manual review |

### Leg Status Values

| Status | Description |
|--------|-------------|
| `exact` | Event/market/selection matched perfectly |
| `approximate` | Close match but odds or details differ |
| `missing` | Could not find equivalent on target bookmaker |

---

## Authentication

OddSwitch uses API key authentication via the `X-API-Key` header.

### Header Format

```http
X-API-Key: your-api-key-here
```

### API Key Security

- Keys are SHA-256 hashed before storage (raw keys are never stored)
- Rate limiting is per API key
- Keys can have custom rate limit overrides

### Generating API Keys

```python
import hashlib
import secrets

# Generate a secure key
raw_key = secrets.token_urlsafe(48)
key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

print(f"Give to client: {raw_key}")
print(f"Store in DB:    {key_hash}")
```

### Rate Limits

Default limits (configurable per key):
- **10 requests/second**
- **100 requests/minute**

Exceeding limits returns HTTP 429 (Rate Limit Exceeded).

---

## Implementation Guide

### Backend Integration (Node.js/Express Example)

```javascript
// oddswitch.js - OddSwitch client
const ODDSWITCH_BASE_URL = process.env.ODDSWITCH_URL;
const ODDSWITCH_API_KEY = process.env.ODDSWITCH_API_KEY;

async function createTranslation(source, target, code, callbackUrl = null) {
  const response = await fetch(`${ODDSWITCH_BASE_URL}/v1/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ODDSWITCH_API_KEY,
    },
    body: JSON.stringify({
      source_bookmaker: source,
      target_bookmaker: target,
      booking_code: code,
      callback_url: callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Translation request failed');
  }

  return response.json();
}

async function getJobStatus(jobId) {
  const response = await fetch(
    `${ODDSWITCH_BASE_URL}/v1/translate/${jobId}`,
    {
      headers: {
        'X-API-Key': ODDSWITCH_API_KEY,
      },
    }
  );
  return response.json();
}

module.exports = { createTranslation, getJobStatus };
```

```javascript
// routes/translation.js
const express = require('express');
const router = express.Router();
const { createTranslation, getJobStatus } = require('../oddswitch');

// Create translation job
router.post('/translate', async (req, res) => {
  try {
    const { source_bookmaker, target_bookmaker, booking_code } = req.body;

    // Construct callback URL for this user
    const callbackUrl = `${process.env.BASE_URL}/webhook/oddswitch/${req.user.id}`;

    const result = await createTranslation(
      source_bookmaker,
      target_bookmaker,
      booking_code,
      callbackUrl
    );

    res.json({
      job_id: result.job_id,
      status: result.status,
      // If cached, include result immediately
      ...(result.result && { result: result.result })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Poll job status
router.get('/translate/:jobId', async (req, res) => {
  try {
    const status = await getJobStatus(req.params.jobId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Backend Integration (Python/FastAPI Example)

```python
# oddswitch_client.py
import httpx
from typing import Optional

ODDSWITCH_BASE_URL = "https://your-oddswitch-api.com"
ODDSWITCH_API_KEY = "your-api-key"

async def create_translation(
    source: str,
    target: str,
    code: str,
    callback_url: Optional[str] = None
) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{ODDSWITCH_BASE_URL}/v1/translate",
            headers={"X-API-Key": ODDSWITCH_API_KEY},
            json={
                "source_bookmaker": source,
                "target_bookmaker": target,
                "booking_code": code,
                "callback_url": callback_url,
            },
        )
        response.raise_for_status()
        return response.json()

async def get_job_status(job_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ODDSWITCH_BASE_URL}/v1/translate/{job_id}",
            headers={"X-API-Key": ODDSWITCH_API_KEY},
        )
        response.raise_for_status()
        return response.json()
```

```python
# main.py
from fastapi import FastAPI, HTTPException
from oddswitch_client import create_translation, get_job_status

app = FastAPI()

@app.post("/api/translate")
async def translate_booking_code(
    source_bookmaker: str,
    target_bookmaker: str,
    booking_code: str,
    user_id: str,  # from auth
):
    callback_url = f"https://yourplatform.com/webhook/oddswitch?user={user_id}"

    try:
        result = await create_translation(
            source_bookmaker,
            target_bookmaker,
            booking_code,
            callback_url
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translate/{job_id}")
async def check_translation(job_id: str):
    try:
        return await get_job_status(job_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Frontend Integration

### React Component Example

```jsx
// components/BookingCodeTranslator.jsx
import { useState, useEffect } from 'react';

const BOOKMAKERS = [
  { id: 'sportybet', name: 'SportyBet', logo: '/logos/sportybet.png' },
  { id: 'bet9ja', name: 'Bet9ja', logo: '/logos/bet9ja.png' },
];

export default function BookingCodeTranslator() {
  const [source, setSource] = useState('sportybet');
  const [target, setTarget] = useState('bet9ja');
  const [code, setCode] = useState('');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const startTranslation = async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_bookmaker: source,
          target_bookmaker: target,
          booking_code: code,
        }),
      });

      const data = await response.json();

      if (data.result) {
        // Cache hit - immediate result
        setResult(data.result);
        setStatus('completed');
      } else {
        // Need to poll
        setJobId(data.job_id);
        pollStatus(data.job_id);
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const pollStatus = async (id) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/translate/${id}`);
        const data = await response.json();

        if (data.status === 'completed') {
          setResult(data.result);
          setStatus('completed');
        } else if (data.status === 'failed') {
          setError(data.error?.message || 'Translation failed');
          setStatus('error');
        } else {
          // Still processing, poll again
          setTimeout(poll, 2000);
        }
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    poll();
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence > 0.9) return { color: 'green', text: 'High Confidence' };
    if (confidence > 0.7) return { color: 'yellow', text: 'Medium Confidence' };
    return { color: 'red', text: 'Low Confidence - Review Recommended' };
  };

  return (
    <div className="translator-container">
      <h2>Translate Booking Code</h2>

      {/* Source Selection */}
      <div className="bookmaker-select">
        <label>From:</label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          {BOOKMAKERS.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Target Selection */}
      <div className="bookmaker-select">
        <label>To:</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {BOOKMAKERS.filter(b => b.id !== source).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Booking Code Input */}
      <div className="code-input">
        <label>Booking Code:</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g., ABC123XYZ"
        />
      </div>

      <button
        onClick={startTranslation}
        disabled={status === 'loading' || !code}
      >
        {status === 'loading' ? 'Translating...' : 'Translate'}
      </button>

      {/* Loading State */}
      {status === 'loading' && (
        <div className="loading">
          <p>Translating your booking code...</p>
          <p>This usually takes 10-30 seconds</p>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => setStatus('idle')}>Try Again</button>
        </div>
      )}

      {/* Result */}
      {status === 'completed' && result && (
        <div className="result">
          <h3>Translation Complete!</h3>

          <div className="translated-code">
            <span className="label">Your {BOOKMAKERS.find(b => b.id === target)?.name} Code:</span>
            <code className="code">{result.translated_code}</code>
            <button onClick={() => navigator.clipboard.writeText(result.translated_code)}>
              Copy
            </button>
          </div>

          {/* Confidence Badge */}
          {(() => {
            const badge = getConfidenceBadge(result.confidence);
            return (
              <div className={`confidence-badge ${badge.color}`}>
                {badge.text} ({(result.confidence * 100).toFixed(0)}%)
              </div>
            );
          })()}

          {/* Odds Comparison */}
          <div className="odds-comparison">
            <div>
              <span>Source Odds: {result.source_odds.toFixed(2)}</span>
            </div>
            <div>
              <span>Target Odds: {result.target_odds.toFixed(2)}</span>
            </div>
            <div className={result.odds_delta >= 0 ? 'positive' : 'negative'}>
              <span>Delta: {result.odds_delta >= 0 ? '+' : ''}{result.odds_delta.toFixed(2)}</span>
            </div>
          </div>

          {/* Leg Details */}
          <details className="leg-details">
            <summary>View Selection Details ({result.legs.length} bets)</summary>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Market</th>
                  <th>Selection</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {result.legs.map((leg, idx) => (
                  <tr key={idx} className={leg.status}>
                    <td>{leg.event}</td>
                    <td>{leg.market}</td>
                    <td>{leg.selection}</td>
                    <td>{(leg.confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {/* Warning for low confidence */}
          {result.confidence < 0.7 && (
            <div className="warning">
              <strong>⚠️ Low Confidence Match</strong>
              <p>Some selections could not be matched exactly. Please review the bet details on {BOOKMAKERS.find(b => b.id === target)?.name} before placing.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### CSS Styling

```css
/* styles/translator.css */
.translator-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.bookmaker-select, .code-input {
  margin-bottom: 15px;
}

.bookmaker-select label, .code-input label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.bookmaker-select select, .code-input input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.translated-code {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin: 15px 0;
  text-align: center;
}

.translated-code .code {
  display: block;
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
  color: #2196f3;
}

.confidence-badge {
  display: inline-block;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 14px;
  margin: 10px 0;
}

.confidence-badge.green { background: #4caf50; color: white; }
.confidence-badge.yellow { background: #ff9800; color: white; }
.confidence-badge.red { background: #f44336; color: white; }

.odds-comparison {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
  padding: 15px;
  background: #fafafa;
  border-radius: 8px;
}

.odds-comparison .positive { color: #4caf50; }
.odds-comparison .negative { color: #f44336; }

.warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 15px;
  margin-top: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

td, th {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

tr.exact { background: #e8f5e9; }
tr.approximate { background: #fff3e0; }
tr.missing { background: #ffebee; }
```

---

## Webhook Handling

### Webhook Payload

When a translation completes, OddSwitch sends a POST request to your `callback_url`:

```json
{
  "job_id": "01HXZ...",
  "status": "completed",
  "result": {
    "translated_code": "5CJJLLH",
    "confidence": 0.95,
    "status": "semantically_equivalent",
    "source_odds": 15.5,
    "target_odds": 14.2,
    "odds_delta": -1.3,
    "legs": [...]
  }
}
```

### Webhook Handler (Express)

```javascript
// webhook.js
const crypto = require('crypto');

// Optional: Verify webhook signature (if implemented)
function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhook/oddswitch/:userId', express.json(), async (req, res) => {
  // Acknowledge immediately
  res.status(200).json({ received: true });

  const { job_id, status, result, error } = req.body;
  const userId = req.params.userId;

  // Update user's translation in your database
  await db.translations.update(
    { job_id, user_id: userId },
    {
      status,
      result,
      error,
      completed_at: new Date(),
    }
  );

  // Optional: Send push notification
  if (status === 'completed') {
    await notifyUser(userId, {
      type: 'translation_complete',
      title: 'Booking Code Translated!',
      body: `Your code is ready: ${result.translated_code}`,
      data: { job_id, result },
    });
  }
});
```

---

## Error Handling

### Common Error Codes

| Error Code | HTTP Status | Meaning | Resolution |
|------------|-------------|---------|------------|
| `AUTHENTICATION_FAILED` | 401 | Invalid or missing API key | Check X-API-Key header |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Implement exponential backoff |
| `BOOKMAKER_NOT_SUPPORTED` | 400 | Bookmaker ID not recognized | Check supported bookmakers list |
| `INVALID_BOOKING_CODE` | 400 | Malformed booking code | Validate code format before sending |
| `JOB_NOT_FOUND` | 404 | Job ID doesn't exist | Check job_id spelling |
| `TRANSLATION_FAILED` | 500 | Pipeline error | Retry with exponential backoff |
| `UNSUPPORTED_MARKET` | 422 | Market type cannot be translated | Report to OddSwitch admin |

### Retry Strategy

```javascript
async function callOddSwitchWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Don't retry on client errors (4xx except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

---

## Best Practices

### 1. Caching Strategy

- Cache successful translations in your database
- Key by `(source, target, code)` for quick lookups
- Invalidate when odds change significantly

### 2. Polling vs Webhooks

| Method | Best For | Implementation |
|--------|----------|----------------|
| Polling | Simple integrations, mobile apps | Poll every 2-3 seconds |
| Webhooks | Real-time updates, server-side | Implement webhook handler |
| Hybrid | Production systems | Use both for reliability |

### 3. User Experience

- Show a progress indicator during translation (10-60 seconds typical)
- Display confidence warnings for matches < 0.9
- Always show odds comparison
- Provide "Copy Code" button for the result
- Link to the target bookmaker's bet slip (if URL format known)

### 4. Rate Limiting

- Implement client-side rate limiting (max 1 request per user per 5 seconds)
- Queue translation requests if needed
- Cache results to reduce API calls

### 5. Error UX

```
User-Friendly Error Messages:
- "Invalid booking code" → "Please check your booking code and try again"
- "TRANSLATION_FAILED" → "Unable to translate this code. The match may have started or the code expired."
- "Rate limit exceeded" → "Please wait a moment before trying again"
```

---

## Troubleshooting

### Translation Taking Too Long

- Check if OddSwitch workers are running: `GET /health`
- Large slips (10+ legs) take longer
- Peak hours may have queue backlog

### Low Confidence Results

- Events may have already started
- Market types may not be supported
- Team name variations not in database

### Webhooks Not Received

- Verify callback URL is publicly accessible
- Check firewall isn't blocking OddSwitch IP
- Ensure webhook responds within 10 seconds
- Check SSL certificate is valid

### Booking Code Not Found

- Code may have expired (varies by bookmaker)
- Code may already be settled/cancelled
- Try loading code manually on bookmaker site to verify

### Odds Mismatch

- Normal behavior - odds vary between bookmakers
- Odds may have changed since code creation
- Show delta prominently to users

---

## Support

For technical support or feature requests:

- **Documentation**: This guide
- **API Issues**: Check `/health` endpoint status
- **Feature Requests**: Contact your OddSwitch administrator

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-04-28 | Initial release with SportyBet & Bet9ja support |
