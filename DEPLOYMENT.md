# Deployment Guide

Target: Hostinger VPS — 1 vCPU, 4 GB RAM, Linux.  
Stack: Traefik (SSL) → Next.js frontend + Fastify backend + PostgreSQL + Redis + **Ollama (CPU)**.

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
| `OLLAMA_MODEL` | Model to use (default: `qwen2.5:1.5b`) |

`OLLAMA_BASE_URL` is hardcoded to `http://ollama:11434` in the compose file — do not change it unless you move Ollama off the internal Docker network.

### 3. Build containers

```bash
docker compose -f docker-compose.prod.yml build
```

### 4. Start infrastructure (Ollama first, so the model can be pulled before backend starts)

```bash
# Start Ollama alone
docker compose -f docker-compose.prod.yml up -d ollama

# Wait for it to be healthy, then pull the model
./scripts/pull-ollama-model.sh

# Start everything else
docker compose -f docker-compose.prod.yml up -d
```

---

## Model management

### Pull / update the model

```bash
# Pull into the running container (model is persisted in the ollama_data volume)
docker exec ollama ollama pull qwen2.5:1.5b

# Or use the helper script
./scripts/pull-ollama-model.sh

# Confirm the model is loaded
docker exec ollama ollama list
```

### Switch to a different model

1. Edit `.env`: `OLLAMA_MODEL=<new-model>`
2. Pull the new model: `docker exec ollama ollama pull <new-model>`
3. Restart the backend: `docker compose -f docker-compose.prod.yml restart backend`

---

## Verify Ollama is working

### Check container health

```bash
docker compose -f docker-compose.prod.yml ps ollama
# STATUS should show "(healthy)"
```

### Quick API test via the backend endpoint

```bash
curl -s https://<your-domain>/api/ai/test | python3 -m json.tool
# Expected: { "status": "ok", "model": "qwen2.5:1.5b", ... }
```

### Direct Ollama call from the VPS (port bound to 127.0.0.1 only)

```bash
curl -s http://127.0.0.1:11434/api/tags | python3 -m json.tool
```

---

## Checking logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Ollama only
docker compose -f docker-compose.prod.yml logs -f ollama

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend --tail 100
```

---

## Restarting services

```bash
# Restart a single service
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart ollama

# Full restart (keeps volumes intact)
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d
```

---

## Updating the application

```bash
git pull

# Rebuild changed services
docker compose -f docker-compose.prod.yml build backend frontend

# Rolling restart (keeps Ollama + DB + Redis up)
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```

---

## Troubleshooting on a low-memory VPS

### OOM / container killed

```bash
free -h                         # check available RAM
docker stats --no-stream        # check per-container usage
```

`qwen2.5:1.5b` needs ~1.2 GB RAM. If the system is tight:

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

### Ollama unhealthy / never starts

```bash
docker compose -f docker-compose.prod.yml logs ollama
# Common causes:
#   - Model not pulled yet  → ./scripts/pull-ollama-model.sh
#   - Port conflict on 11434 → lsof -i :11434
```

### Backend cannot reach Ollama

```bash
# Confirm both are on the "internal" network
docker network inspect <project>_internal | grep -A3 '"Name"'

# Test connectivity from inside the backend container
docker exec <backend-container> curl -s http://ollama:11434/api/tags
```

### Slow AI responses

`qwen2.5:1.5b` on 1 vCPU averages 3–8 tokens/second. Predictions are cached in Redis for 1 hour. If the first call times out, increase the `AbortSignal.timeout` in `ai.routes.ts` (currently 120 s).

### Model not found error (HTTP 404 from Ollama)

```bash
docker exec ollama ollama list          # check what is pulled
docker exec ollama ollama pull qwen2.5:1.5b
docker compose -f docker-compose.prod.yml restart backend
```

---

## Environment variable reference

| Variable | Where set | Default | Description |
|---|---|---|---|
| `OLLAMA_BASE_URL` | compose / `.env` | `http://ollama:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `.env` | `qwen2.5:1.5b` | Model name |
| `OLLAMA_NUM_PARALLEL` | compose | `1` | Max concurrent inference requests |
| `OLLAMA_MAX_LOADED_MODELS` | compose | `1` | Models kept in memory simultaneously |
