## Setup & start (GolfTrainer)

This guide gets you from zero → running **backend + mobile** locally.

### Prerequisites
- **Node.js + npm** (Node 18+)
- **PostgreSQL 16+**
- (Optional) Android Studio emulator / iOS simulator

### Repo structure
- **`backend/`**: Fastify + TypeScript + Prisma
- **`mobile/`**: Expo (React Native) + TypeScript
- **`prisma/schema.prisma`**: shared Prisma schema (used by backend)

## PostgreSQL

Use any local PostgreSQL setup you prefer (installer, Docker, package manager, etc.).

### Connection string options

#### Option A: use default `postgres` DB + separate schema

```text
postgresql://postgres:<PASSWORD>@localhost:5432/postgres?schema=golftrainer
```

#### Option B: create dedicated DB `golftrainer`

```text
postgresql://postgres:<PASSWORD>@localhost:5432/golftrainer?schema=public
```

## Backend

### 1) Install dependencies

```bash
npm --prefix backend install
```

### 2) Configure env (Supabase default)
Create `backend/.env.supabase` (do not commit it). You can start by copying `backend/env.supabase.example`.

Minimum required variables:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (32+ chars)
- `JWT_REFRESH_SECRET` (32+ chars)

Example:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require&schema=public
JWT_ACCESS_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
```

### 3) Generate Prisma client (Supabase default)

```bash
npm --prefix backend run prisma:generate
```

### 4) Create/update database tables in Supabase

```bash
npm --prefix backend run prisma:db:push
```

### 5) Start backend (Supabase default)

```bash
npm --prefix backend run dev
```

Backend listens on:
- `http://localhost:3000`
- API prefix: `http://localhost:3000/api/v1`


### Supabase values: what goes where

In `backend/.env.supabase`:

- `DATABASE_URL`: from **Supabase Dashboard → Project Settings → Database → Connection string → URI** (direct host), and ensure it includes `sslmode=require&schema=public`.
- `JWT_ACCESS_SECRET`: your backend app secret (any strong random string, 32+ chars).
- `JWT_REFRESH_SECRET`: your backend app secret (any strong random string, 32+ chars, different from access secret).
- `PORT`: backend API port (usually `3000`).

Important: `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are for this backend auth system and are **not** Supabase anon/service role keys.

### Fast local ↔ Supabase switching

Use separate env files so you can switch databases without editing values each time:

- `backend/.env.local` → local PostgreSQL
- `backend/.env.supabase` → Supabase PostgreSQL

Start from templates:

```bash
cp backend/env.local.example backend/.env.local
cp backend/env.supabase.example backend/.env.supabase
```

Then run targeted commands:

```bash
# backend against local DB
npm --prefix backend run dev:local

# backend against supabase DB
npm --prefix backend run dev

# push schema to local DB
npm --prefix backend run prisma:db:push:local

# push schema to supabase DB
npm --prefix backend run prisma:db:push:supabase
```

## Mobile (Expo)

### 1) Install dependencies

```bash
npm --prefix mobile install
```

### 2) Start Metro / Expo

```bash
npm --prefix mobile start
```

> Important: run Expo from the `mobile/` project (or use `npm --prefix mobile ...` from repo root).

### API base URL notes
The app uses `mobile/src/shared/api/config.ts`.

- Android emulator uses `10.0.2.2` for host machine APIs.
- iOS simulator / web can use `localhost`.

This repo is already set up to choose the host automatically.

### Prisma migrations for Supabase

Recommended flow:

1. Create migrations locally first:

```bash
npm --prefix backend run prisma:migrate:dev:local
```

2. Apply migrations to Supabase:

```bash
npm --prefix backend run prisma:migrate:deploy:supabase
```

If you need a one-time schema sync to Supabase during setup, `prisma:db:push:supabase` is available.

## Useful commands

```bash
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix mobile run typecheck
```

## Common issues

### Prisma error: “Environment variable not found: DATABASE_URL”
For default commands, ensure `backend/.env.supabase` exists and has `DATABASE_URL`.
For local commands (`*:local`), ensure `backend/.env.local` exists and has `DATABASE_URL`.

### Expo port already in use
Stop the process using Metro’s port (typically `8081`) and restart Expo.
