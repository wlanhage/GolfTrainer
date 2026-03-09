# GolfTrainer backend-arkitektur (Node.js + TypeScript + Fastify + Prisma)

> Fokus: **ren, enkel och skalbar** arkitektur som går att implementera direkt.

Den här designen utgår från **Fastify** (kan mappas till Express med samma lagerstruktur).

## 1) Föreslagen mappstruktur

```txt
backend/
  src/
    app.ts
    server.ts

    config/
      env.ts
      logger.ts

    common/
      errors/
        AppError.ts
        error-codes.ts
      middleware/
        auth.middleware.ts
        request-context.middleware.ts
      validation/
        validate.ts
      types/
        auth.ts
        fastify.d.ts

    infrastructure/
      prisma/
        client.ts
      jwt/
        jwt.service.ts
      password/
        password.service.ts

    modules/
      auth/
        auth.routes.ts
        auth.controller.ts
        auth.service.ts
        auth.repository.ts
        auth.schema.ts
        auth.mapper.ts

      users/
        users.routes.ts
        users.controller.ts
        users.service.ts
        users.repository.ts
        users.schema.ts
        users.mapper.ts

      clubs/
        clubs.routes.ts
        clubs.controller.ts
        clubs.service.ts
        clubs.repository.ts
        clubs.schema.ts
        clubs.mapper.ts

      practice-sessions/
        practiceSessions.routes.ts
        practiceSessions.controller.ts
        practiceSessions.service.ts
        practiceSessions.repository.ts
        practiceSessions.schema.ts

      drills/
        drills.routes.ts
        drills.controller.ts
        drills.service.ts
        drills.repository.ts
        drills.schema.ts

      drill-attempts/
        drillAttempts.routes.ts
        drillAttempts.controller.ts
        drillAttempts.service.ts
        drillAttempts.repository.ts
        drillAttempts.schema.ts

      shots/
        shots.routes.ts
        shots.controller.ts
        shots.service.ts
        shots.repository.ts
        shots.schema.ts

      stats/
        stats.routes.ts
        stats.controller.ts
        stats.service.ts
        stats.repository.ts
        stats.schema.ts

      recommendations/
        recommendations.routes.ts
        recommendations.controller.ts
        recommendations.service.ts
        recommendations.repository.ts
        recommendations.schema.ts

    jobs/
      stats-recompute.job.ts
      recommendation-feedback.job.ts

    plugins/
      auth.plugin.ts
      prisma.plugin.ts

  prisma/
    schema.prisma
    migrations/

  tests/
    integration/
    unit/
```

### Varför detta fungerar
- **Modulbaserat**: varje domänfeature är isolerad.
- **Lagerbaserat inom modul**: samma pattern överallt, lätt för team att följa.
- **Infrastruktur separat**: Prisma/JWT/hash ligger utanför domänlogik.

---

## 2) Ansvarsfördelning: routes, controllers, services, repositories

### `routes`
Ansvar:
- definiera endpoint + HTTP-metod
- koppla Zod-schema för request/response
- koppla middleware (auth, rate limit)
- anropa controller

Inte ansvar:
- business logic
- db-access

### `controllers`
Ansvar:
- läsa validerad input från request
- hämta `userId` från auth context
- anropa service
- returnera statuskod + DTO

Inte ansvar:
- tunga regler/beräkningar
- direkta Prisma-anrop

### `services`
Ansvar:
- affärsregler, transaktioner, orkestrering
- ownership-verifiering
- anropa flera repositories
- trigga domänevents/loggning

Inte ansvar:
- HTTP-specifika detaljer

### `repositories`
Ansvar:
- enda stället där Prisma används
- kapsla querydetaljer, include/select, pagination
- alltid ta `userId` där datan är privat

Inte ansvar:
- affärsregler

---

## 3) Auth middleware (JWT) – rekommenderat flöde

### Tokens
- **Access token** (kortlivad, t.ex. 15 min)
- **Refresh token** (långlivad, roteras)

### Middleware-steg (`auth.middleware.ts`)
1. Läs `Authorization: Bearer <token>`.
2. Verifiera signatur och `exp` via `jwt.service`.
3. Extrahera claims: `sub` (=userId), `tokenVersion`.
4. Lägg i request context: `request.auth = { userId, jti, scope }`.
5. Om ogiltig token: kasta `UnauthorizedError`.

### Refresh-flöde
- Hasha refresh token i DB.
- Vid refresh:
  - verifiera token
  - kontrollera ej revoked/expired
  - rotera: revoka gammal + spara ny hash
- Vid logout: revoka aktiv token chain.

---

## 4) Säker user ownership i alla endpoints

Grundregel: **alla privata queries ska vara user-scopade i repository-lagret**.

### Mönster
- Controller skickar alltid `auth.userId` till service.
- Service skickar `userId` till repository.
- Repository filtrerar alltid med `where: { id, userId }` eller `where: { userId, ... }`.

### Exempel
Fel (osäkert):
```ts
prisma.shotEntry.findUnique({ where: { id: shotId } })
```
Rätt (säkert):
```ts
prisma.shotEntry.findFirst({ where: { id: shotId, userId } })
```

### Extra skydd
- Använd DB-index med `userId` för snabb och konsekvent filtering.
- Returnera 404 vid ej hittad eller ej ägd resurs (undvik informationsläcka).

---

## 5) Isolera stats och recommendations från CRUD

## Stats-modul
- CRUD-moduler (`shots`, `drill-attempts`, `sessions`) sparar rådata.
- `stats.service.ts` ansvarar för aggregat (overview, trend, consistency).
- Skriv gärna snapshots i `UserMetricSnapshot` för snabb läsning.
- Tyngre beräkningar flyttas till `jobs/stats-recompute.job.ts`.

## Recommendations-modul
- `recommendations.service.ts` har eget interface:
  - `getRecommendation(context, userId)`
  - `recordFeedback(recommendationId, feedback, userId)`
- Läser features från rådata/statstabeller via `recommendations.repository.ts`.
- Loggar beslut i `RecommendationLog`.
- Hålls separerad från CRUD så ni kan byta modellmotor senare utan API-ombyggnad.

---

## 6) Exempel: request flow route -> database

Exempel: `POST /api/v1/drill-attempts`

1. **Route**
   - auth middleware
   - Zod body-validation (`successCount`, `attemptCount`, `drillId`, `sessionId?`)
2. **Controller**
   - läser `userId` från `request.auth`
   - anropar `drillAttemptsService.createAttempt(input, userId)`
3. **Service**
   - verifierar regel: `attemptCount > 0`, `0 <= successCount <= attemptCount`
   - verifierar att drill finns
   - verifierar att session (om skickad) ägs av `userId`
   - skapar attempt via repository
   - emitterar `DomainEvent` (AttemptCreated)
   - triggar ev. lätt stats-refresh
4. **Repository**
   - Prisma create med `userId`
   - returnerar entity
5. **Controller**
   - mappar entity -> response DTO
   - svarar `201 Created`

---

## 7) Error handling, validation och logging

## Validation
- Zod på route-nivå för params/query/body.
- Re-use schemas per modul i `*.schema.ts`.
- Validera även domänregler i service (inte bara shape-validate i Zod).

## Error handling
- Standardisera feltyper:
  - `ValidationError` (400)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `InternalError` (500)
- Central Fastify error handler mappar `AppError -> HTTP`.
- Returnera konsekvent format:
```json
{
  "error": {
    "code": "DRILL_ATTEMPT_INVALID_SCORE",
    "message": "successCount måste vara mellan 0 och attemptCount",
    "requestId": "..."
  }
}
```

## Logging
- Använd strukturerad logger (Pino via Fastify).
- Logga alltid:
  - `requestId`
  - `userId` (om auth)
  - endpoint + duration + status
- Logga aldrig:
  - lösenord
  - access/refresh tokens
  - känsliga payloads i klartext
- Lägg domänloggar i service-lagret för viktiga händelser.

---

## Direkt implementerbar startplan (rekommenderad)

1. Sätt upp `app.ts/server.ts`, env, logger, prisma plugin.
2. Implementera `auth` modul fullständigt först.
3. Implementera `users` + `clubs`.
4. Lägg till `practice-sessions`, `drill-attempts`, `shots`.
5. Bygg `stats` read-endpoints ovanpå rådata.
6. Lägg in `recommendations` med enkel regelmotor + logging (ingen ML ännu).

Detta ger en snabb MVP utan att låsa in er tekniskt inför framtida AI/rekommendationer.
