# Deployment Guide

Target: Hostinger VPS — 1 vCPU, 4 GB RAM, Linux.  
Stack: Traefik (SSL) → Next.js frontend + Fastify backend + PostgreSQL + Redis. AI match predictions call the hosted **NVIDIA AI** API — no local inference container to manage.

---

## Prerequisites

```bash
# Install Docker + Docker Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login after this

# Create the external Traefik network (once per server)
docker network create web
```

---

## First-time setup

### 1. Clone the repo

```bash
git clone <your-repo-url> /opt/app
cd /opt/app
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` and fill in every `CHANGE_ME` value:

| Variable | Description |
|---|---|
| `DOMAIN` | Your domain, e.g. `example.com` |
| `ACME_EMAIL` | Email for Let's Encrypt |
| `DB_PASSWORD` | Strong random password for Postgres |
| `REDIS_PASSWORD` | Strong random password for Redis |
| `SECRET_KEY` | JWT signing secret (`openssl rand -hex 32`) |
| `ADMIN_INVITE_KEY` | Admin registration token |
| `FOOTBALL_API_KEY` | API-Football key |
| `NVIDIA_API_KEY` | NVIDIA AI API key (get one at https://build.nvidia.com) |
| `NVIDIA_MODEL` | Model to use (default: `nvidia/nemotron-3-super-120b-a12b`) |

`NVIDIA_BASE_URL` defaults to `https://integrate.api.nvidia.com/v1` in the compose file — only override it if you're routing through a proxy or self-hosted NIM instance.

### 3. Build containers

```bash
docker compose -f docker-compose.prod.yml build
```

### 4. Start everything

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Switching to a different model

1. Edit `.env`: `NVIDIA_MODEL=<new-model>` (must be a model slug available on https://build.nvidia.com)
2. Restart the backend: `docker compose -f docker-compose.prod.yml restart backend`

---

## Verify NVIDIA AI is working

### Quick API test via the backend endpoint

```bash
curl -s https://<your-domain>/api/ai/test | python3 -m json.tool
# Expected: { "status": "ok", "model": "nvidia/nemotron-3-super-120b-a12b", ... }
```

If this returns a 502/503, check:
- `NVIDIA_API_KEY` is set correctly in `.env`
- The model slug in `NVIDIA_MODEL` exists and is enabled for your API key
- The VPS has outbound internet access to `integrate.api.nvidia.com`

---

## Checking logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend --tail 100
```

---

## Restarting services

```bash
# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Full restart (keeps volumes intact)
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d
```

---

## Updating the application

```bash
git pull

# Rebuild changed services
docker compose -f docker-compose.prod.yml build backend frontend

# Rolling restart
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```

---

## Troubleshooting on a low-memory VPS

### OOM / container killed

```bash
free -h                         # check available RAM
docker stats --no-stream        # check per-container usage
```

Since AI inference now runs on NVIDIA's hosted infrastructure rather than a local model container, the backend's own memory footprint is small. If the system is still tight:

```bash
# Stop non-essential containers temporarily
docker compose -f docker-compose.prod.yml stop frontend

# Or add a swap file (2 GB recommended as overflow buffer)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Slow or failing AI responses

Predictions are cached in Redis for 1 hour. If requests are timing out, check NVIDIA's API status and increase the `AbortSignal.timeout` in `ai.routes.ts` (currently 120 s for match predictions, 60 s for free-text predict/test).

### NVIDIA AI returns 401/403

The `NVIDIA_API_KEY` is missing, invalid, or the model in `NVIDIA_MODEL` isn't enabled for that key. Verify both in the `.env` on the server and re-run:

```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## Environment variable reference

| Variable | Where set | Default | Description |
|---|---|---|---|
| `NVIDIA_API_KEY` | `.env` | — | NVIDIA AI API key from https://build.nvidia.com |
| `NVIDIA_BASE_URL` | compose / `.env` | `https://integrate.api.nvidia.com/v1` | NVIDIA AI API base URL |
| `NVIDIA_MODEL` | `.env` | `nvidia/nemotron-3-super-120b-a12b` | Model slug |
