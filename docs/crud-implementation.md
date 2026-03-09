# CRUD implementation – clubs, practice sessions, drills, drill attempts, shots

Implementerat i `backend/src/modules/*` med lager:
- `*.routes.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.repository.ts`
- `*.schema.ts`

## User ownership-skydd
- Samtliga CRUD-routes använder `requireAuth`.
- Controllers hämtar `request.auth.userId`.
- Repositories filtrerar med `where: { userId, ... }`.
- `findFirst`/`updateMany`/`deleteMany` med user-scope används för att förhindra access till andras data.

## Endpoints

### Clubs (`/api/v1/clubs`)
- `POST /`
- `GET /`
- `GET /:clubId`
- `PATCH /:clubId`
- `DELETE /:clubId`

### Practice sessions (`/api/v1/practice-sessions`)
- `POST /`
- `GET /`
- `GET /:sessionId`
- `PATCH /:sessionId`
- `DELETE /:sessionId`

### Drills (`/api/v1/drills`)
- `POST /` (owner = current user)
- `GET /` (egna + public)
- `GET /:drillId` (egen eller public)
- `PATCH /:drillId` (bara ägda)
- `DELETE /:drillId` (bara ägda)

### Drill attempts (`/api/v1/drill-attempts`)
- `POST /`
- `GET /`
- `GET /:attemptId`
- `PATCH /:attemptId`
- `DELETE /:attemptId`

API-fältnamn stöder explicit:
- `successfulAttempts`
- `totalAttempts`

Lagring i DB:
- `successCount`
- `attemptCount`

### Shots (`/api/v1/shots`)
- `POST /`
- `GET /`
- `GET /:shotId`
- `PATCH /:shotId`
- `DELETE /:shotId`

`ShotEntry` behandlas som rådata (append-friendly modell med `recordedAt`, mätfält, tags, notes).

