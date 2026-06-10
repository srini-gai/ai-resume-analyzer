# ResumeIQ — Claude Code Instructions

## CRITICAL: docker-compose.yml
NEVER overwrite or simplify docker-compose.yml.
This file contains VPS-specific Traefik routing labels essential 
for SSL and routing on the production server.

The frontend service MUST always have:
- networks: internal + n8n_default
- All traefik.http.* labels (see current file)
- VITE_API_URL: "https://resumeanalyzer.pro"

The db service MUST always have:
- POSTGRES_PASSWORD hardcoded (env var substitution fails on this VPS)
- networks: internal only

If adding a new service, copy the pattern from existing services 
and preserve ALL existing labels and networks.

## Environment
- Production URL: https://resumeanalyzer.pro
- VPS: Hostinger KVM2 at 187.127.151.27
- SSL: Handled by Traefik (certresolver: mytlschallenge)
- Network: n8n_default (external, shared with Traefik + other projects)
- Secrets: /opt/ai-resume-analyzer/.env.production (never commit)
- ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 
  SESSION_SECRET, MAIL_USER, MAIL_PASS, DATABASE_URL all in .env.production

## Deployment
After any code change:
1. git push origin main (from Windows)
2. On VPS: git pull origin main && docker compose down && docker compose up -d --build
3. Never run docker compose down -v (destroys postgres data)

## Never do
- Remove traefik labels from frontend service
- Remove n8n_default from frontend networks  
- Change VITE_API_URL to empty string or localhost
- Add ports: mapping to frontend (Traefik handles routing)
- Commit .env.production or any secrets
- Overwrite docker-compose.yml without preserving ALL existing labels
