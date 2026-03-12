# GolfTrainer

GolfTrainer is a mobile-first training app for golfers who want to log practice, follow progress, and build better habits over time.

This README is intentionally simple and focused on getting started.
Technical and architecture details have been moved into the `docs/` folder.

## What this project includes

- **Mobile app**: React Native + Expo (TypeScript)
- **Backend API**: Fastify + TypeScript + Prisma
- **Database**: PostgreSQL

## Quick start

1. Read the full setup guide: **[`SETUP.md`](./SETUP.md)**
2. Start backend:
   - `npm --prefix backend install`
   - `npm --prefix backend run dev`
3. Start mobile app:
   - `npm --prefix mobile install`
   - `npm --prefix mobile start`

## Project structure

- `backend/` – API server
- `mobile/` – Expo app
- `prisma/schema.prisma` – database schema
- `docs/` – architecture/design/implementation docs

## Documentation map

If you want the technical breakdown, start here:

- **[`docs/README.md`](./docs/README.md)** – documentation index

## License

MIT. See [`LICENSE`](./LICENSE).
