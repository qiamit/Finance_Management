# Ledger — Family Portfolio

Multi-family portfolio tracker (React + TypeScript + Fastify + Postgres) deployed on Railway.

## Local

```bash
cp .env.example .env
docker compose up -d
cd apps/api && npx prisma migrate deploy && cd ../..
npm install
npm run build -w @fm/shared
npm run dev -w @fm/api
npm run dev -w @fm/web
```

Web: http://localhost:5173  
API: http://localhost:3001

Set `GEMINI_API_KEY` and optional `CASPARSER_API_KEY` in Railway when ready. Angel One credentials are entered per member in the Import page.
