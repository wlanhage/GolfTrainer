## Setup & start (GolfTrainer)

This guide gets you from zero → running **backend + mobile** locally.

### Prerequisites
- **Node.js + npm** (Node 18+ recommended; this repo also works on newer Node)
- **PostgreSQL 16+**
- (Optional) Android Studio emulator / iOS simulator

### Repo structure
- **`backend/`**: Fastify + TypeScript + Prisma
- **`mobile/`**: Expo (React Native) + TypeScript
- **`prisma/schema.prisma`**: shared Prisma schema (used by backend)

## PostgreSQL (Windows)

### Install
If you don’t have Postgres yet:

```powershell
winget install -e --id PostgreSQL.PostgreSQL.16
```

### Ensure service is running

```powershell
Get-Service postgresql-x64-16
```

### Create database (two options)

#### Option A (easiest): use the default `postgres` database + separate schema
You don’t need to create a database; Prisma will create tables in a dedicated schema namespace:

- Use this `DATABASE_URL` pattern:

```text
postgresql://postgres:<PASSWORD>@localhost:5432/postgres?schema=golftrainer
```

#### Option B: create a dedicated database `golftrainer`
Create the database in **pgAdmin** (recommended for beginners):
- Open **pgAdmin 4**
- Connect to your local server
- Right click **Databases** → **Create** → **Database…**
- Name: `golftrainer`

- Use this `DATABASE_URL` pattern:

```text
postgresql://postgres:<PASSWORD>@localhost:5432/golftrainer?schema=public
```

## Backend

### 1) Install dependencies

```powershell
npm --prefix backend install
```

### 2) Configure env
Create `backend/.env` (do not commit it). You can start by copying `backend/env.example`.

Minimum required variables:
- **`DATABASE_URL`**: see examples above
- **`JWT_ACCESS_SECRET`**: at least 32 characters
- **`JWT_REFRESH_SECRET`**: at least 32 characters

Example (values are placeholders):

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:<PASSWORD>@localhost:5432/postgres?schema=golftrainer
JWT_ACCESS_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=change_me_to_a_long_random_string_min_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
```

### 3) Create tables from Prisma schema
This repo currently uses `db push` for local bootstrap (no migrations committed yet).

```powershell
npm --prefix backend run prisma:db:push
```

You should see output like “Your database is now in sync with your Prisma schema”.

### Prisma Studio (optional)
To inspect your DB via a browser UI:

```powershell
npm --prefix backend run prisma:studio
```

Studio will start on `http://localhost:5555`.

### 4) Start backend

```powershell
npm --prefix backend run dev
```

Backend listens on:
- `http://localhost:3000`
- API prefix: `http://localhost:3000/api/v1`

## Mobile (Expo)

### 1) Install dependencies

```powershell
npm --prefix mobile install
```

### 2) Start Metro / Expo

```powershell
npm --prefix mobile start
```

**Important:** run Expo from the `mobile/` project (either `npm --prefix mobile ...` from repo root, or `cd mobile` first).
If you run `npx expo start` from the repo root, Expo will look for `./package.json` and fail because this repo is not a single root Expo project.

### API base URL notes
The app uses `mobile/src/shared/api/config.ts`.

- **Android emulator** cannot reach your host via `localhost`. It must use **`10.0.2.2`**.
- iOS simulator / web can use `localhost`.

This repo is already set up to choose the correct host automatically.

## Common issues

### Port already in use (Expo / Metro)
If Expo says a port is already in use, find the PID and kill it:

```powershell
netstat -ano | findstr :8081
taskkill /PID <PID> /F
```

Then start Expo again.

### Prisma error: “Environment variable not found: DATABASE_URL”
Prisma requires `DATABASE_URL` when running `db push`.
- Put `DATABASE_URL=...` in `backend/.env` and rerun:

```powershell
npm --prefix backend run prisma:db:push
```

### Can’t remember the `postgres` password
You need the password you set during installation. If you don’t know it, you must reset it (safe approach is to temporarily adjust `pg_hba.conf` and then set a new password). If you want, paste the error you get when connecting and we’ll walk through the reset step-by-step.

