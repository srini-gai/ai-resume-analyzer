#!/bin/bash
set -e

DOMAIN="resumeanalyzer.pro"
EMAIL="mukmady@gmail.com"

echo "==> Step 1: Starting services with HTTP config..."
cp frontend/nginx.conf frontend/nginx.conf.bak
docker compose up -d --build
echo "Waiting 10s for nginx to be ready..."
sleep 10

echo "==> Step 2: Obtaining SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Step 3: Switching nginx to HTTPS config..."
cp frontend/nginx-ssl.conf frontend/nginx.conf

echo "==> Step 4: Reloading nginx with SSL..."
docker compose restart frontend

sleep 5

echo "==> Step 5: Verifying..."
curl -sf "https://$DOMAIN/api/health" && echo " HTTPS API is healthy!" || echo " Check logs: docker compose logs frontend"

echo ""
echo "Done! App is live at https://$DOMAIN"
