# Deploy-guide

## Översikt

- **Frontend (webbapp)** → Vercel
- **Backend (Fastify)** → Render
- **Databas** → Supabase (Postgres)

## 1. Supabase — connection strings

I Supabase dashboard: **Project Settings → Database → Connection string**.

Du behöver två URL:er (båda mot samma databas, olika portar):

| Variabel | Port | Använding |
|---|---|---|
| `DATABASE_URL` | **6543** | Pooled connection (PgBouncer) — runtime queries |
| `DIRECT_URL` | **5432** | Direct connection — Prisma migrations + introspection |

Format på `DATABASE_URL` (pooler):
```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

Format på `DIRECT_URL` (direct):
```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres
```

## 2. Backend — Render

### A. Via render.yaml (rekommenderat)

1. Push repo till GitHub
2. På [render.com](https://render.com): **New → Blueprint** → välj repo
3. Render läser `render.yaml` automatiskt
4. Fyll i de tre env-vars med `sync: false`:
   - `DATABASE_URL` — Supabase pooled
   - `DIRECT_URL` — Supabase direct
   - `CORS_ORIGINS` — t.ex. `https://golftrainer.vercel.app,https://*.vercel.app`
5. Klicka **Apply**. Första builden tar 3-5 min.
6. Render ger dig en URL: `https://golftrainer-backend.onrender.com`
7. Verifiera: `curl https://golftrainer-backend.onrender.com/health` → `{"status":"ok",...}`

### B. Manuellt via dashboard

1. **New → Web Service** → välj repo
2. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/health`
3. Lägg till alla env-vars enligt `render.yaml`

### Pushar Prisma-schema till Supabase

Render kör inte `prisma db push` automatiskt under deploy. Kör en gång lokalt:

```bash
# I backend-mappen, med .env.supabase ifylld (eller exportera DATABASE_URL/DIRECT_URL i shell)
npm --prefix backend run prisma:db:push:supabase
```

Detta skapar tabellerna i Supabase. Görs om vid schema-ändringar.

## 3. Frontend — Vercel

1. På [vercel.com](https://vercel.com): **New Project** → välj repo
2. Settings:
   - **Root Directory**: `webbapp`
   - **Framework Preset**: Next.js (auto-detect)
3. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<din-backend>.onrender.com/api/v1`
4. Deploy. Vercel ger URL: `https://golftrainer.vercel.app`
5. Tillbaka till Render → uppdatera `CORS_ORIGINS` med din Vercel-URL om du inte använde wildcards
6. (Valfritt) Custom domain via Vercel dashboard

## 4. Skapa första admin-användaren

Backend har inget UI för att assigna ADMIN-roll, så första admin görs i Supabase SQL Editor:

```sql
-- Efter att en användare registrerat sig via /register:
UPDATE "User" SET role = 'ADMIN' WHERE email = 'din@email.com';
```

Nu kan den användaren skapa banor, missions m.m. via `/admin` på frontend.

## Felsökning

### Render cold start tar 30-60 sek
Free-tier spinner ned efter 15 min inaktivitet. Första request efter idle är långsam. Lösningar:
- Acceptera det (rimligt för personlig/demo-app)
- Sätt upp en cron som pingar `/health` var 14:e minut (UptimeRobot, cron-job.org)
- Uppgradera till Render Starter ($7/mån) — alltid aktiv

### Prisma connection-pool fel
Om du ser `prepared statement "s0" already exists` → använd pooler-URL med `?pgbouncer=true&connection_limit=1`.

### CORS-fel från frontend
Kontrollera att din Vercel-URL finns i `CORS_ORIGINS` på Render. Wildcard `https://*.vercel.app` täcker preview-deploys.

### Webbappens API-anrop går till localhost
`NEXT_PUBLIC_API_URL` måste sättas i Vercel **innan build** — env-variabler bakas in i client-bundle. Re-deploya efter att du satt den.
