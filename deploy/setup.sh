#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time VPS provisioning script (Ubuntu 22.04 / 24.04)
# Run as root on a fresh Hostinger VPS:
#   bash setup.sh yourdomain.com
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: bash setup.sh <yourdomain.com>}"
APP_DIR="/var/www/project"
EMAIL="${2:-admin@${DOMAIN}}"    # Let's Encrypt contact email

echo "════════════════════════════════════════"
echo "  Provisioning VPS for $DOMAIN"
echo "════════════════════════════════════════"

# ── 1. System updates ─────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y \
  curl git wget unzip build-essential \
  nginx certbot python3-certbot-nginx \
  python3 python3-pip python3-venv \
  ufw ca-certificates gnupg lsb-release

# ── 2. Node.js 20 LTS ────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v
echo "✓ Node.js installed"

# ── 3. PM2 ───────────────────────────────────────────────────────────────────
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
mkdir -p /var/log/pm2
echo "✓ PM2 installed"

# ── 4. Docker (for PostgreSQL + Redis) ───────────────────────────────────────
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
echo "✓ Docker installed"

# ── 5. Playwright system dependencies (for OddSwitch / Bet9ja scraper) ───────
apt-get install -y \
  chromium-browser \
  libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 \
  libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2
echo "✓ Playwright dependencies installed"

# ── 6. Firewall ───────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "✓ Firewall configured"

# ── 7. Nginx config ───────────────────────────────────────────────────────────
# Replace placeholder domain in the nginx config
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$(dirname "$0")/nginx.conf" \
  > /etc/nginx/sites-available/project
ln -sf /etc/nginx/sites-available/project /etc/nginx/sites-enabled/project
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
echo "✓ Nginx configured"

# ── 8. SSL certificate (Let's Encrypt) ───────────────────────────────────────
certbot --nginx \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --redirect
echo "✓ SSL certificate obtained"

# ── 9. App directory + clone ──────────────────────────────────────────────────
mkdir -p "$APP_DIR"
echo ""
echo "▶  Paste your repo SSH/HTTPS URL to clone, or press Enter to skip:"
read -r REPO_URL
if [[ -n "$REPO_URL" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
  echo "✓ Repo cloned to $APP_DIR"
else
  echo "  Skipped — copy your project to $APP_DIR manually"
fi

# ── 10. OddSwitch Python venv ─────────────────────────────────────────────────
if [[ -d "$APP_DIR/oddswitch" ]]; then
  cd "$APP_DIR/oddswitch"
  python3 -m venv venv
  venv/bin/pip install --upgrade pip
  venv/bin/pip install -r requirements.txt
  venv/bin/playwright install chromium
  mkdir -p /var/log/oddswitch
  echo "✓ OddSwitch Python environment ready"
fi

# ── 11. OddSwitch systemd services ───────────────────────────────────────────
for svc in oddswitch-api oddswitch-celery-translate oddswitch-celery-browser; do
  src="$(dirname "$0")/systemd/${svc}.service"
  if [[ -f "$src" ]]; then
    cp "$src" /etc/systemd/system/
    systemctl enable "$svc"
  fi
done
systemctl daemon-reload
echo "✓ OddSwitch systemd services registered"

echo ""
echo "════════════════════════════════════════"
echo "  Setup complete!"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Copy env files:"
echo "     cp $APP_DIR/backend/.env.example  $APP_DIR/backend/.env"
echo "     cp $APP_DIR/frontend/.env.example $APP_DIR/frontend/.env.local"
echo "     cp $APP_DIR/oddswitch/.env.example $APP_DIR/oddswitch/.env"
echo "  2. Fill in all values in those .env files"
echo "  3. Start the database:  cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"
echo "  4. Run the deploy script: bash $APP_DIR/deploy/deploy.sh"
