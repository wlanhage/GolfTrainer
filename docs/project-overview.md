# Project overview (MVP)

## Architecture at a glance

- Mobile client: **React Native + Expo + TypeScript**
- Backend API: **Node.js + TypeScript + Fastify**
- Database: **PostgreSQL + Prisma ORM**
- Auth: **JWT access + refresh tokens**
- API validation: **Zod**

## Guiding principles

- **Backend-centric business logic**: analysis, statistics, and recommendation logic live in backend services.
- **Clear layering**: routes → controllers → services → repositories.
- **Data privacy by design**: user-owned data is always scoped by `userId`.
- **Raw data first**: store granular training events so stats and AI can evolve later.
- **Async-ready design**: heavy recomputation/recommendations can move to background jobs without breaking API contracts.

## Deployment direction

- Start simple with a modular monolith backend and PostgreSQL.
- Add background jobs/cache later (for stats recomputation and recommendations).
