#!/usr/bin/env bash
# ============================================================================
# Gerbtrace — Supabase Self-Hosted Setup Script
# ============================================================================
# Installs Docker, Supabase (via Docker Compose), nginx with SSL,
# and generates all secrets automatically.
#
# Run on the DigitalOcean Droplet as root:
#   bash setup-supabase-droplet.sh
#
# Requirements:
#   - Ubuntu 22.04 or 24.04
#   - Domain api.gerbtrace.com pointing to this server's IP
#   - Port 80 and 443 open
# ============================================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

DOMAIN="api.gerbtrace.com"
SITE_URL="https://gerbtrace.com"
SUPABASE_DIR="/opt/supabase"
SECRETS_FILE="/root/.gerbtrace-secrets"

# ANSI colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*"; exit 1; }

# ── Step 1: Install Docker ─────────────────────────────────────────────────

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
    return
  fi

  log "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  log "Docker installed: $(docker --version)"
}

# ── Step 2: Generate secrets ───────────────────────────────────────────────

generate_secrets() {
  if [[ -f "$SECRETS_FILE" ]]; then
    warn "Secrets file already exists at $SECRETS_FILE — loading existing secrets"
    source "$SECRETS_FILE"
    return
  fi

  log "Generating cryptographic secrets..."

  JWT_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
  DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | head -c 16)

  # Generate ANON_KEY (JWT with role=anon)
  ANON_KEY=$(generate_jwt "$JWT_SECRET" "anon")

  # Generate SERVICE_ROLE_KEY (JWT with role=service_role)
  SERVICE_ROLE_KEY=$(generate_jwt "$JWT_SECRET" "service_role")

  # Save secrets to file (root-only readable)
  cat > "$SECRETS_FILE" << EOF
# Gerbtrace Supabase Secrets — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
# DO NOT commit this file or share it.
JWT_SECRET=$JWT_SECRET
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
  chmod 600 "$SECRETS_FILE"
  log "Secrets saved to $SECRETS_FILE"
}

generate_jwt() {
  local secret="$1"
  local role="$2"

  # JWT header: {"alg":"HS256","typ":"JWT"}
  local header=$(echo -n '{"alg":"HS256","typ":"JWT"}' | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')

  # JWT payload with role, issued-at, and 10-year expiry
  local iat=$(date +%s)
  local exp=$((iat + 315360000))  # 10 years
  local payload=$(echo -n "{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')

  # HMAC-SHA256 signature
  local signature=$(echo -n "${header}.${payload}" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')

  echo "${header}.${payload}.${signature}"
}

# ── Step 3: Clone and configure Supabase ───────────────────────────────────

setup_supabase() {
  log "Setting up Supabase at $SUPABASE_DIR..."

  if [[ -d "$SUPABASE_DIR" ]]; then
    warn "Supabase directory already exists — pulling latest"
    cd "$SUPABASE_DIR/docker"
    git pull --ff-only 2>/dev/null || true
  else
    git clone --depth 1 https://github.com/supabase/supabase.git "$SUPABASE_DIR"
    cd "$SUPABASE_DIR/docker"
  fi

  # Copy example env and override with our values
  cp -n .env.example .env 2>/dev/null || true

  log "Writing Supabase configuration..."

  # Use sed to replace values in .env (preserving structure)
  sed_env "JWT_SECRET" "$JWT_SECRET"
  sed_env "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
  sed_env "ANON_KEY" "$ANON_KEY"
  sed_env "SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
  sed_env "DASHBOARD_USERNAME" "admin"
  sed_env "DASHBOARD_PASSWORD" "$DASHBOARD_PASSWORD"

  # Site and API URLs
  sed_env "SITE_URL" "$SITE_URL"
  sed_env "API_EXTERNAL_URL" "https://$DOMAIN"
  sed_env "SUPABASE_PUBLIC_URL" "https://$DOMAIN"

  # Additional redirect URLs for auth callbacks
  sed_env "ADDITIONAL_REDIRECT_URLS" "https://gerbtrace.com/auth/callback,https://*.gerbtrace.com/auth/callback,tauri://localhost/auth/callback,http://localhost:3000/auth/callback"

  # Enable GitHub OAuth (placeholder — user fills in later)
  sed_env "GOTRUE_EXTERNAL_GITHUB_ENABLED" "true"
  sed_env "GOTRUE_EXTERNAL_GITHUB_CLIENT_ID" ""
  sed_env "GOTRUE_EXTERNAL_GITHUB_SECRET" ""
  sed_env "GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI" "https://$DOMAIN/auth/v1/callback"

  # Disable email confirmation for now (easier testing), enable later
  sed_env "ENABLE_EMAIL_AUTOCONFIRM" "true"
  sed_env "ENABLE_EMAIL_SIGNUP" "true"

  # Studio / Dashboard
  sed_env "STUDIO_PORT" "3100"

  # Don't expose Postgres externally (use localhost only)
  # The docker-compose.yml binds to 0.0.0.0 by default — we'll firewall it

  log "Supabase configuration written"
}

sed_env() {
  local key="$1"
  local val="$2"
  # Replace the line matching key= with key=value, or append if missing
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

# ── Step 4: Start Supabase ─────────────────────────────────────────────────

start_supabase() {
  cd "$SUPABASE_DIR/docker"

  log "Pulling Supabase Docker images (this may take a few minutes)..."
  docker compose pull -q

  log "Starting Supabase services..."
  docker compose up -d

  # Wait for services to be healthy
  log "Waiting for services to start..."
  local attempts=0
  while [[ $attempts -lt 30 ]]; do
    if curl -sf http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY" >/dev/null 2>&1; then
      log "Supabase API is responding!"
      break
    fi
    sleep 5
    attempts=$((attempts + 1))
    echo -n "."
  done
  echo

  if [[ $attempts -ge 30 ]]; then
    warn "Supabase may not be fully healthy yet. Check: docker compose ps"
  fi
}

# ── Step 5: Install and configure nginx ────────────────────────────────────

setup_nginx() {
  log "Installing nginx..."
  apt-get install -y -qq nginx

  log "Creating nginx configuration for $DOMAIN..."
  cat > /etc/nginx/sites-available/supabase << EOF
# Supabase API reverse proxy for Gerbtrace
server {
    listen 80;
    server_name $DOMAIN;

    # API and Auth
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support (Supabase Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        # Allow large file uploads (Gerber files)
        client_max_body_size 20M;
    }
}

# Block direct access to Supabase Studio from public internet
# Studio is available only via SSH tunnel: ssh -L 3100:localhost:3100 root@$DOMAIN
EOF

  # Remove default site, enable supabase
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/supabase

  nginx -t || err "nginx configuration test failed"
  systemctl enable nginx
  systemctl restart nginx
  log "nginx configured and running"
}

# ── Step 6: SSL with Let's Encrypt ─────────────────────────────────────────

setup_ssl() {
  log "Installing certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx

  log "Requesting SSL certificate for $DOMAIN..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --email "admin@gerbtrace.com" --redirect \
    || warn "SSL setup failed — make sure $DOMAIN DNS points to this server ($(curl -s ifconfig.me))"
}

# ── Step 7: Firewall ───────────────────────────────────────────────────────

setup_firewall() {
  log "Configuring UFW firewall..."
  ufw --force reset >/dev/null 2>&1
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp
  ufw allow 443/tcp
  # Block external Postgres access (Docker binds to 0.0.0.0:5432)
  ufw deny 5432/tcp
  ufw deny 8000/tcp  # Kong — only accessible via nginx
  ufw deny 3100/tcp  # Studio — only via SSH tunnel
  ufw --force enable
  log "Firewall enabled: SSH, HTTP, HTTPS allowed; Postgres, Kong, Studio blocked externally"
}

# ── Step 8: Print summary ──────────────────────────────────────────────────

print_summary() {
  local ip=$(curl -s ifconfig.me 2>/dev/null || echo "<server-ip>")

  echo
  echo "============================================================"
  echo "  Gerbtrace Supabase Setup Complete!"
  echo "============================================================"
  echo
  echo "  Server IP:        $ip"
  echo "  API URL:          https://$DOMAIN"
  echo "  Supabase Studio:  http://localhost:3100 (via SSH tunnel)"
  echo "  Studio login:     admin / $DASHBOARD_PASSWORD"
  echo
  echo "  ── Keys (for your Nuxt app / GitHub Secrets) ──"
  echo
  echo "  SUPABASE_URL=$ANON_KEY"
  echo "  SUPABASE_URL=https://$DOMAIN"
  echo "  SUPABASE_ANON_KEY=$ANON_KEY"
  echo "  SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo
  echo "  ── Secrets file ──"
  echo "  All secrets saved to: $SECRETS_FILE"
  echo
  echo "  ── Next steps ──"
  echo "  1. Point DNS: $DOMAIN -> $ip"
  echo "  2. Run SSL:   certbot --nginx -d $DOMAIN"
  echo "     (if DNS wasn't ready during setup)"
  echo "  3. Apply database migrations (from your local machine):"
  echo "     psql 'postgresql://postgres:${POSTGRES_PASSWORD}@${ip}:5432/postgres' \\"
  echo "       -f supabase/migrations/20260215000000_initial_schema.sql \\"
  echo "       -f supabase/migrations/20260215000001_rls_policies.sql \\"
  echo "       -f supabase/migrations/20260215000002_functions.sql \\"
  echo "       -f supabase/seed.sql"
  echo "  4. Set GitHub OAuth credentials in $SUPABASE_DIR/docker/.env"
  echo "  5. Set SMTP credentials for email in $SUPABASE_DIR/docker/.env"
  echo "  6. Add GitHub Actions secrets (see summary above)"
  echo
  echo "============================================================"
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
  echo
  log "Starting Gerbtrace Supabase setup on $(hostname)..."
  echo

  install_docker
  generate_secrets
  setup_supabase
  start_supabase
  setup_nginx
  setup_firewall

  # Only attempt SSL if DNS is pointing here
  local my_ip=$(curl -s ifconfig.me 2>/dev/null)
  local dns_ip=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
  if [[ "$dns_ip" == "$my_ip" ]]; then
    setup_ssl
  else
    warn "DNS for $DOMAIN does not point to $my_ip yet (resolved to: ${dns_ip:-nothing})"
    warn "Skipping SSL — run 'certbot --nginx -d $DOMAIN' after DNS propagates"
  fi

  print_summary
}

main "$@"
