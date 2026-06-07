#!/bin/bash
set -e

DOMAIN="resumeanalyzer.pro"
EMAIL="mukmady@gmail.com"

echo "==> Step 1: Starting app containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

echo "==> Waiting for containers to be ready..."
sleep 8
docker compose ps

echo "==> Step 2: Installing certbot (if not installed)..."
apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true

echo "==> Step 3: Copying nginx site config..."
cp resumeanalyzer.pro.nginx /etc/nginx/sites-available/resumeanalyzer.pro
ln -sf /etc/nginx/sites-available/resumeanalyzer.pro /etc/nginx/sites-enabled/resumeanalyzer.pro

echo "==> Step 4: Testing nginx config..."
nginx -t

echo "==> Step 5: Reloading nginx..."
systemctl reload nginx

echo "==> Step 6: Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --redirect

echo "==> Step 7: Reloading nginx with SSL..."
systemctl reload nginx

echo ""
curl -sf "https://$DOMAIN/api/health" && echo "API is healthy!" || echo "Check: docker compose logs"
echo ""
echo "Done! Live at https://$DOMAIN"
