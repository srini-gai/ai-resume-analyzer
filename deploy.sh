#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Rebuilding and restarting containers..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "==> Waiting for health check..."
sleep 8
docker compose ps

echo "==> Checking API health..."
curl -sf https://resumeanalyzer.pro/api/health && echo " API is healthy" || echo " API health check failed"

echo "==> Done. App is live at https://resumeanalyzer.pro"
