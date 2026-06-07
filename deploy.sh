#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building and starting containers..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "==> Waiting for health check..."
sleep 5
docker compose ps

echo "==> Checking API health..."
curl -sf http://localhost/api/health && echo " API is healthy" || echo " API health check failed"

echo "==> Done. App is live at http://187.127.151.27"
