# Production Deployment

This deployment is fully Dockerized:

| Service | Public | Notes |
| --- | --- | --- |
| Traefik | 80, 443 | Reverse proxy and Let's Encrypt SSL |
| Frontend | internal 3000 | Next.js standalone container |
| Backend | internal 4000 | Fastify container; runs migrations on start |
| AI Service | internal 8000 | FastAPI prediction service |
| OddSwitch API | internal 8000 | Booking-code translation API |
| OddSwitch Workers | internal | Celery translation and browser workers |
| PostgreSQL | internal 5432 | Persistent Docker volume |
| Redis | internal 6379 | Persistent Docker volume |

## Server Setup

Install Docker and Compose v2, then clone the repo:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

git clone YOUR_REPO_URL /var/www/project
cd /var/www/project
docker network create web
```

Create the production env file:

```bash
cp .env.example .env
nano .env
```

Fill in `DOMAIN`, `ACME_EMAIL`, `DB_PASSWORD`, `REDIS_PASSWORD`, `SECRET_KEY`, `ADMIN_INVITE_KEY`, and any API/OAuth/SMTP keys you use.

## First Deploy

```bash
cd /var/www/project
bash deploy/deploy.sh
```

The script pulls the latest code, creates the external Traefik network if missing, builds Docker images, starts the stack, and checks `/health`.

## Deploy From Published Images

If GitHub Actions publishes images to GHCR, set these in `/var/www/project/.env`:

```bash
IMAGE_REGISTRY=ghcr.io
IMAGE_NAMESPACE=YOUR_OWNER/YOUR_REPO
IMAGE_TAG=latest
```

Then deploy by pulling instead of building:

```bash
docker login ghcr.io
DEPLOY_MODE=pull bash deploy/deploy.sh
```

## GitHub Actions CI/CD

The workflow in `.github/workflows/production.yml` runs both app pipelines:

- Pull requests: backend CI, frontend CI, and Docker build validation.
- Pushes to `main`: all CI checks, Docker build validation, GHCR image publishing, and production deploy over SSH.
- Manual runs: optional production deploy over SSH when `deploy=true` after images are published.

Published images:

```bash
ghcr.io/YOUR_OWNER/YOUR_REPO/backend:latest
ghcr.io/YOUR_OWNER/YOUR_REPO/frontend:latest
ghcr.io/YOUR_OWNER/YOUR_REPO/ai-service:latest
ghcr.io/YOUR_OWNER/YOUR_REPO/oddswitch-api:latest
ghcr.io/YOUR_OWNER/YOUR_REPO/oddswitch-worker:latest
ghcr.io/YOUR_OWNER/YOUR_REPO/oddswitch-browser-worker:latest
```

The workflow lowercases `YOUR_OWNER/YOUR_REPO` before publishing because container image names must be lowercase.

Repository variable or secret:

- `PRODUCTION_DOMAIN`: production domain without `https://`

Repository secrets for SSH deployment:

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY` or `PRODUCTION_PASSWORD`
- `PRODUCTION_APP_DIR` (optional, defaults to `/var/www/project`)

Automatic deployment runs after every successful push to `main`. Manual deployment from Actions still uses the workflow dispatch input `deploy=true`. The SSH job logs into GHCR on the server, exports the image variables used by `docker-compose.prod.yml`, and starts the published images for the exact commit.

OddSwitch runs on the Docker network at `http://oddswitch-api:8000`; the backend uses that URL in production. The deploy script also initializes submodules so the server can build OddSwitch locally when `DEPLOY_MODE=build`.

Required server-side `/var/www/project/.env` values still include `DOMAIN`, `ACME_EMAIL`, `DB_PASSWORD`, `REDIS_PASSWORD`, `SECRET_KEY`, and `ADMIN_INVITE_KEY`.

## Common Commands

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml restart backend frontend
docker compose -f docker-compose.prod.yml down
```

Only ports 80 and 443 should be publicly exposed. PostgreSQL and Redis stay on the internal Docker network.
