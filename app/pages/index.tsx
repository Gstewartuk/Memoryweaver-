```markdown
# Memory Weaver — Next.js + Supabase + PDF Worker (starter)

This repo contains a starter scaffold for Memory Weaver:

- app/ — Next.js (frontend + API routes)
- worker/ — Puppeteer PDF worker (Docker-ready) that uploads PDFs to Supabase Storage

Quick overview
1. Create a Supabase project and run the SQL in `app/supabase-sql.md`.
2. Create storage buckets: `memories` (images) and `pdfs` (PDF output).
3. Add environment variables from `app/.env.local.example` to Vercel (or `.env.local` for local dev).
4. Deploy the worker to Render (or another container host). Provide WORKER_SECRET and Supabase service role key.
5. Deploy the Next.js app to Vercel and set the same environment variables (server-side keys masked).

Local dev
- app:
  - cd app
  - npm install
  - npm run dev
- worker:
  - cd worker
  - npm install
  - npm run dev
  - (or build the Dockerfile for production)

Notes
- Keep SUPABASE_SERVICE_ROLE_KEY secret (server-only).
- The worker needs WORKER_SECRET to accept requests from the Next.js server.
```
