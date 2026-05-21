# OddSwitch Engine — Production Readiness Checklist

Everything below is what **YOU** need to do before this system handles real money.
Items marked ⚡ are blockers. Items marked 🔧 are important but can be iterated on.

---

## ⚡ SportyBet Adapter — ✅ IMPLEMENTED

The SportyBet adapter (`app/browser/adapters/sportybet.py`) is now **fully implemented**
with real Playwright automation. DOM selectors verified against live site on 2026-04-28.

### Share URL Format
```
https://www.sportybet.com/?shareCode={code}&c=ng
```

### Verified DOM Selectors
| Element | Selector | Notes |
|---|---|---|
| Betslip container | `#j_betslip` | Main sidebar panel |
| Item list | `#j_betslip .m-list` | Contains all selection rows |
| Each item | `#j_betslip .m-list .m-item` | One per leg |
| Selection | `.m-item-play span` | "Home", "Away", "Over", etc. |
| Event name | `.m-item-team` | `title` attribute has full untruncated name |
| Market type | `.m-item-market` | "Over/Under", "Winner", etc. |
| Odds | `.m-item-odds .m-text-main` | May have ↑↓ arrows when odds change |
| Sport icon | `.m-lay-left i` | Class name indicates sport type |
| Accept Changes | `button:has-text('Accept Changes')` | Green button — must click before booking |
| Book Bet | `.m-share--wrapper a:has-text('Book Bet')` | Text link below the green button |
| Booking code modal | Modal appears after clicking Book Bet | Code is 5-8 char alphanumeric |

### What the adapter handles:
- ✅ Popup/overlay dismissal (cookie banners, app prompts)
- ✅ Odds change arrows (↑↓) stripped during parsing
- ✅ Sport detection from icon class (football, basketball, tennis, etc.)
- ✅ Team name parsing (`v`, `vs`, `,` separators)
- ✅ "Accept Changes" flow before booking
- ✅ Multi-strategy booking code extraction from modal

### What you may need to tune:
- **Selectors may break** when SportyBet updates their frontend. Monitor and update.
- **Modal code extraction** uses 3 fallback strategies but may need a 4th if the modal structure changes.
- **Proxy rotation** is critical — SportyBet will ban IPs that hit too frequently.

---

## ⚡ Bet9ja Adapter — ✅ IMPLEMENTED & VERIFIED

The Bet9ja adapter (`app/browser/adapters/bet9ja.py`) is now **fully implemented**
with real Playwright automation. DOM selectors verified via live extraction on 2026-04-28.

### Share URL Format
```
https://sports.bet9ja.com/?bookABetCode={code}
```

### ⚠️ CRITICAL: System Chrome Required
Bet9ja's Cloudflare blocks Playwright's bundled Chromium at the **TLS/network level**
(`ERR_HTTP2_PROTOCOL_ERROR`). The `BrowserManager` now launches with `channel="chrome"`
to use your system Chrome, which has the real Chrome TLS fingerprint and bypasses detection.

| Browser | Result |
|---|---|
| Playwright Chromium (headless) | ❌ `ERR_HTTP2_PROTOCOL_ERROR` |
| System Chrome headless (`channel="chrome"`) | ✅ **Works** — 15 legs extracted |
| System Chrome headful (Xvfb) | ✅ **Works** |

### ⚠️ CRITICAL: Print Dialog Suppression
Bet9ja auto-triggers `window.print()` when loading a booking code URL.
The adapter handles this by injecting `window.print = () => {}` via
`page.add_init_script()` **before** navigation. This prevents the browser
from blocking.

### Verified DOM Selectors (Live Extraction 2026-04-28)
| Element | Selector | Notes |
|---|---|---|
| Each match | `.betslip__match` | One per event, may contain multiple selections |
| Match header | `.betslip__match-head` | Contains event name + close button |
| Event name | `.betslip__match-head .betslip__match-item.pointer strong` | "Team A - Team B" |
| Live score | `.betslip__match-head span.txt-orange` | e.g., "1:0" (live events only) |
| Match body | `.betslip__match-body` | Contains selection sections |
| Selection section | `.betslip__match-section` | One per bet on this event |
| Selection name | `.betslip__match-item.pointer strong` (in row 1) | "Draw", "Al Hilal SFC", etc. |
| Odds | `.betslip__match-odds span` | e.g., "1.04" |
| Market | `.betslip__match-item` (row 2, item 1) | "1X2", "Handicap", "DC", etc. |
| League | `.betslip__match-item` (row 2, item 2) | "Saudi Professional League", etc. |
| Betslip body | `.betslip__body` | Main betslip container |
| Book a Bet | `button:has-text('Book a Bet')` | Yellow button at bottom |

### Booking Code Modal Structure
After clicking "Book a Bet", a modal appears containing:
- **"My Booking Code"** heading
- Code in large bordered box (e.g., `5CJJLLH`)
- Green "Booking Code:" label with code + copy icon
- "Stake: ₦X | Total Odds: Y" info bar
- Share buttons (Facebook, WhatsApp, Telegram, etc.)

### Live Test Results (2026-04-28)
```
Booking Code: 5CJJLLH → 15 legs extracted
  [1] Šentjur - KK Sencur           | KK Sencur (Home +2.5)  | Handicap   | 1.83
  [2] Stockport County - Port Vale   | Draw                   | 1X2        | 5.10
  [3] Norrkoping - Landskrona        | Draw                   | 1X2        | 3.95
  [4] Norrkoping - Landskrona        | Norrkoping             | 1X2 2UP    | 1.59
  [5] Al Hilal SFC - Damac           | Al Hilal SFC           | 1X2 1UP    | 1.04
  ...
  Total Odds: 353,516.94
```

### What the adapter handles:
- ✅ System Chrome via `channel="chrome"` (bypasses Cloudflare TLS fingerprint)
- ✅ `window.print()` suppression (prevents browser blocking)
- ✅ Multi-selection events (same event, multiple bets)
- ✅ Live score prefix removal from event names
- ✅ Sport inference from league names (basketball: "Korisliiga", hockey: "2. Liga")
- ✅ Dash-separated team name parsing ("Team A - Team B")
- ✅ Multi-strategy booking code extraction from modal

### What you may need to tune:
- **System Chrome must be installed** on the server (`google-chrome` or `google-chrome-stable`)
- **Xvfb** required on headless servers for the virtual display
- **Selectors may break** when Bet9ja updates their frontend. Monitor and update.
- **Sport inference** uses keyword matching on league names — may need expansion for niche leagues.



---

## ⚡ CRITICAL: Security Hardening

### API Keys
- [ ] Generate production API keys (NOT `dev-key-123`)
- [ ] Use strong random keys: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- [ ] Store keys securely. Clients get the raw key once. You only store the hash.

### Environment Variables
- [ ] Set strong `POSTGRES_PASSWORD` (not `oddswitch`)
- [ ] Set strong Redis password: `redis://username:PASSWORD@host:6379/0`
- [ ] Never commit `.env` files. Use `.env.example` as template.

### CORS
- [ ] In `app/main.py`, change `allow_origins=["*"]` to your actual client domains
- [ ] Example: `allow_origins=["https://yourdomain.com"]`

### Network
- [ ] Postgres and Redis should NOT be exposed to the internet
- [ ] Only the API port (8000) should be publicly accessible
- [ ] Put a reverse proxy (nginx/Caddy) in front of the API for TLS

---

## ⚡ CRITICAL: Browser Requirements (Bet9ja)

### Root Cause (Corrected 2026-04-28)
The original `ERR_HTTP2_PROTOCOL_ERROR` was **NOT an IP/geo block** — it was caused by
Playwright's bundled **Chromium having a different TLS fingerprint** (JA3 hash) than real Chrome.
Cloudflare detects this at the TLS handshake level, before any JavaScript runs.

### Solution: System Chrome (✅ Verified Working)
| Approach | Result |
|---|---|
| Playwright Chromium (headless) | ❌ `ERR_HTTP2_PROTOCOL_ERROR` |
| **System Chrome** (`channel="chrome"`) | ✅ **15 legs extracted** |
| System Chrome headful + Xvfb | ✅ Works |

**Nigerian residential proxies are NOT needed** when running from a Nigerian IP with system Chrome.

### Server Requirements
1. **System Chrome** must be installed on the server:
   ```bash
   # Ubuntu/Debian
   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
   echo "deb [signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
   sudo apt update && sudo apt install -y google-chrome-stable
   ```

2. **Xvfb** for headless server environments:
   ```bash
   sudo apt install -y xvfb
   # Run with: xvfb-run --auto-servernum python your_script.py
   ```

### Stealth Stack (already implemented)
The browser workers include DarkMatter-level stealth:
- ✅ WebGL vendor/renderer spoofing
- ✅ Canvas noise injection (pixel-level randomization)
- ✅ AudioContext noise injection
- ✅ Navigator shields (webdriver, plugins, languages, hardwareConcurrency)
- ✅ Chrome runtime & extension simulation
- ✅ TLS bypass via system Chrome (`channel="chrome"`)
- ✅ WebRTC IP leak prevention
- ✅ User-agent rotation
- ✅ `window.print()` suppression (Bet9ja specific)

### Optional: Proxies for Rate Limiting
Proxies are **optional** but recommended for high-volume usage to avoid IP-based rate limiting:
- **Bright Data** — best coverage, Nigeria residential pool
- **Oxylabs** — Nigeria residential proxies available
- **Smartproxy** — rotating Nigerian IPs

### VPS Location
For lowest latency to Nigerian bookmakers, deploy the VPS in:
- **Lagos, Nigeria** (if provider available)
- **London, UK** (good peering to Nigeria)
- **Johannesburg, South Africa** (low Africa latency)

---

## 🔧 IMPORTANT: VPS Deployment

### Minimum VPS specs:
- **CPU**: 2 vCPU
- **RAM**: 4 GB minimum (8 GB recommended for browser workers)
- **Disk**: 20 GB SSD
- **OS**: Ubuntu 22.04+

### Deploy steps:
```bash
# On VPS
git clone <your-repo> /opt/oddswitch
cd /opt/oddswitch

# Create production env
cp .env.example .env
# Edit .env with production values

# Build and start
docker compose up -d --build

# Run migrations
docker compose exec api alembic upgrade head

# Seed data
docker compose exec api python scripts/seed_mappings.py
```

### Reverse proxy (nginx):
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL: Use Let's Encrypt (free):
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d api.yourdomain.com
```

---

## 🔧 IMPORTANT: Monitoring

### Health check monitoring:
- Set up an uptime monitor (UptimeRobot, Healthchecks.io) hitting `GET /health`
- Alert if status != "ok"

### Log aggregation:
- Logs are structured JSON — pipe to any log aggregator
- Simple option: `docker compose logs -f api worker browser-worker`
- Production option: Loki + Grafana, or Papertrail

### Prometheus metrics:
- The metrics module is built but not yet wired to an endpoint
- To expose: add `GET /metrics` endpoint using `prometheus_client.generate_latest()`
- Scrape with Prometheus, visualize with Grafana

---

## 🔧 IMPORTANT: Expanding Reference Data

### Team aliases (ongoing):
The seed has 41 aliases. Real bookmakers use hundreds of variations. As you encounter new ones:
```sql
INSERT INTO team_aliases (id, alias, canonical_name, bookmaker, created_at)
VALUES (gen_random_uuid()::text, 'Man U', 'Manchester United', NULL, now());
```

### Event mappings (dynamic):
As you see real translations succeed, store the event mapping for faster future lookups:
```sql
INSERT INTO event_mappings (id, source_event, target_event, source_bookmaker, target_bookmaker, confidence, created_at)
VALUES (gen_random_uuid()::text, 'Arsenal vs Chelsea', 'Arsenal - Chelsea', 'sportybet', 'bet9ja', 0.99, now());
```

### Market mappings:
If bookmakers use different market names, add mappings:
```sql
INSERT INTO market_mappings (id, source_market, target_market, source_bookmaker, target_bookmaker, mapping_type, created_at)
VALUES (gen_random_uuid()::text, 'Draw No Bet', 'Draw No Bet', 'sportybet', 'bet9ja', 'exact', now());
```

---

## 🔧 Scaling (When Ready)

### Horizontal scaling:
```yaml
# docker-compose.yml — scale workers
docker compose up -d --scale worker=4 --scale browser-worker=2
```

### Redis cluster:
- Switch from single Redis to Redis Sentinel or Redis Cluster when load increases
- Update `REDIS_URL` to point to the cluster

### Database:
- Add read replicas for the GET endpoint
- Consider connection pooling with PgBouncer

### Kubernetes (future):
- The Dockerfiles and service separation are already K8s-ready
- Convert docker-compose.yml to Helm chart when needed
- Use HPA (Horizontal Pod Autoscaler) on worker deployments

---

## 🔧 Backup Strategy

### Postgres:
```bash
# Daily backup cron
0 3 * * * docker exec oddswitch-postgres pg_dump -U oddswitch oddswitch | gzip > /backups/oddswitch_$(date +%Y%m%d).sql.gz
```

### Redis:
- Redis is ephemeral cache — losing it just means cold cache
- No backup needed unless you want to persist dedup state

---

## Quick Reference: Dev API Key

| Key | Value |
|---|---|
| Raw key | `dev-key-123` |
| Header | `X-API-Key: dev-key-123` |
| Hash | `0f11c9...` (SHA-256) |

**Delete this key before production.** Generate a new one:
```python
import hashlib, secrets
key = secrets.token_urlsafe(48)
key_hash = hashlib.sha256(key.encode()).hexdigest()
print(f"Raw key (give to client): {key}")
print(f"Key hash (store in DB): {key_hash}")
```

Then insert:
```sql
INSERT INTO api_keys (id, key_hash, name, is_active, created_at)
VALUES ('prod-key-1', '<hash>', 'Production Client 1', true, now());
```
