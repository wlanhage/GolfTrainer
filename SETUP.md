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

### 2) Configure env
Create `backend/.env` (do not commit it). You can start by copying `backend/env.example`.

Minimum required variables:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (32+ chars)
- `JWT_REFRESH_SECRET` (32+ chars)

Example:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:<PASSWORD>@localhost:5432/postgres?schema=golftrainer
JWT_ACCESS_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
```

### 3) Generate Prisma client

```bash
npm --prefix backend run prisma:generate
```

### 4) Create/update database tables

```bash
npm --prefix backend run prisma:db:push
```

### 5) Start backend

```bash
npm --prefix backend run dev
```

Backend listens on:
- `http://localhost:3000`
- API prefix: `http://localhost:3000/api/v1`

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

## Useful commands

```bash
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix mobile run typecheck
```

## Common issues

### Prisma error: “Environment variable not found: DATABASE_URL”
Prisma commands require `DATABASE_URL` in `backend/.env`.

### Expo port already in use
Stop the process using Metro’s port (typically `8081`) and restart Expo.
