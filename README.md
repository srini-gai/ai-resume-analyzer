# ResumeIQ

Production-ready resume analyzer with a React/Vite frontend and Express API. It extracts text from PDF resumes, compares relevant skills against a job description, scores ATS readiness, and exports a PDF report.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Framer Motion, jsPDF
- Backend: Node.js, Express, Multer, pdf-parse, Helmet, rate limiting
- Deployment: Netlify frontend, Render backend, GitHub Actions CI

## Local setup

Requirements: Node.js 20+

```bash
npm install
copy .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`  
API health check: `http://localhost:4000/api/health`

The analyzer is deterministic and requires no third-party AI key. Uploaded PDFs are processed in memory and are not persisted.

## Scripts

```bash
npm run dev       # Start frontend and backend
npm test          # Run all tests
npm run build     # Build both workspaces
npm run check     # Test and build
```

## Environment

| Variable | Service | Description |
| --- | --- | --- |
| `VITE_API_URL` | Netlify | Public Render API URL |
| `PORT` | Render | API port; Render sets this automatically |
| `CLIENT_ORIGIN` | Render | Allowed Netlify URL, or comma-separated URLs |
| `MAX_FILE_SIZE_MB` | Render | Maximum uploaded PDF size |

## Deploy frontend to Netlify

The root `netlify.toml` contains the build command, publish directory, SPA redirect, and security/cache headers.

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_API_URL https://YOUR-API.onrender.com
netlify deploy --build
netlify deploy --build --prod
```

For Git-based deployment, connect the repository in Netlify. Netlify will use `netlify.toml`.

## Deploy backend to Render

The root `render.yaml` is a Render Blueprint. In Render, create a new Blueprint from the repository, then set:

```text
CLIENT_ORIGIN=https://YOUR-SITE.netlify.app
MAX_FILE_SIZE_MB=5
```

Manual Render settings:

```text
Build command: npm install && npm run build -w backend
Start command: npm run start -w backend
Health check: /api/health
```

## Production checklist

- Set `VITE_API_URL` on Netlify to the Render service URL.
- Set `CLIENT_ORIGIN` on Render to the exact Netlify production URL.
- Require GitHub Actions checks before merging to `main`.
- Upgrade from Render's free plan if cold-start latency is unacceptable.
- Review rate limits and file-size limits for expected traffic.
