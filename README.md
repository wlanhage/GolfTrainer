# GolfTrainer – grundarkitektur (MVP + AI-ready)

Detta dokument beskriver en **praktisk, skalbar och enkel grundarkitektur** för en mobil golfapp med fokus på träning, statistik och framtida AI/rekommendationer.

## 1) Övergripande arkitektur

### Arkitekturstil
- **Mobilklient (React Native + Expo + TypeScript)**
- **REST API (Node.js + TypeScript)**
- **PostgreSQL + Prisma ORM**
- **JWT access token + refresh token**
- **Zod för validering i API-lager**

### Principer
- **Backend-centric business logic**: all analys, statistik och rekommendationslogik körs i backend.
- **Tydliga lager**: `routes -> controllers -> services -> repositories (Prisma)`.
- **Dataprivacy by design**: alla tabeller med användardata innehåller `userId` och filtreras alltid per inloggad användare.
- **Rådata först**: spara händelser och resultat i granularitet som möjliggör framtida statistik/ML.
- **Asynkron analysbarhet**: designa så att bakgrundsjobb/AI kan adderas senare utan att bryta API-kontrakt.

### Deployment (enkelt först)
- En backend-tjänst (monolit) med modulär intern struktur.
- PostgreSQL som primär datakälla.
- (Senare) Redis/queue för async jobs och cache.

---

## 2) Huvudmoduler i backend

Föreslagna backend-moduler för V1:

1. **Auth Module**
   - Registrering, login, token refresh, logout.
   - Hashing (argon2/bcrypt), refresh token rotation.

2. **User Module**
   - Profilhantering (namn, hcp-valfritt, dominanthand, mål).

3. **Club Module**
   - Standardklubbor + användarspecifika klubbor.
   - User club metrics (typisk carry/total, min/max, confidence).

4. **Training Module**
   - Träningspass (session start/slut, fokusområde, anteckningar).

5. **Drill Module**
   - Drill-katalog (mallar) och user drill attempts.
   - Resultat: lyckade av totalt, subjektiv svårighet, kommentarer.

6. **Shot Module**
   - Enskilda slagposter (club, carry, total, lie, target shape, outcome).
   - Koppling till session och eventuellt drill attempt.

7. **Stats Module**
   - Aggregat/endpoints för trend över tid.
   - Beräknad data per period (vecka/månad/rullande).

8. **Notes/Journal Module** (kan ligga i training i MVP)
   - Fri text kopplad till pass/drill/shot.

9. **Recommendation-Prep Module** (light i MVP)
   - Endast interfaces + datakontrakt för framtida rekommendationer.
   - Ingen tung AI i V1.

---

## 3) Huvudentiteter/tabeller i databasen

Nedan är en robust basmodell (förenklad):

### Auth & User
- `users`
  - `id`, `email` (unique), `passwordHash`, `createdAt`, `updatedAt`
- `user_profiles`
  - `userId` (PK/FK), `displayName`, `handedness`, `handicap`, `goals`, `updatedAt`
- `refresh_tokens`
  - `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`, `ip`, `userAgent`

### Clubs
- `clubs`
  - `id`, `name`, `category` (driver/iron/wedge/putter), `loft` (nullable)
- `user_clubs`
  - `id`, `userId`, `clubId` (nullable if custom), `label`, `isActive`, `createdAt`
- `user_club_distance_samples` (rådata)
  - `id`, `userId`, `userClubId`, `carryDistance`, `totalDistance` (nullable), `source`, `recordedAt`
- `user_club_distance_stats` (beräknad)
  - `id`, `userId`, `userClubId`, `window` (30d/90d/all), `avgCarry`, `p50Carry`, `p80Carry`, `stdDevCarry`, `sampleSize`, `updatedAt`

### Training & Drills
- `training_sessions`
  - `id`, `userId`, `startedAt`, `endedAt`, `focusArea`, `notes`
- `drills`
  - `id`, `name`, `description`, `metricType` (success_rate, distance_control, dispersion), `isPublic`
- `drill_attempts`
  - `id`, `userId`, `drillId`, `trainingSessionId` (nullable), `successCount`, `attemptCount`, `score` (nullable), `notes`, `createdAt`

### Shots
- `shot_entries` (rådata-kärnan)
  - `id`, `userId`, `trainingSessionId` (nullable), `drillAttemptId` (nullable), `userClubId`, `carryDistance`, `totalDistance` (nullable), `launchDirection` (nullable), `curve` (nullable), `lieType` (nullable), `resultTag` (pure/thin/fat etc), `notes`, `recordedAt`

### Stats/Aggregates
- `user_stat_snapshots`
  - `id`, `userId`, `metricKey`, `periodStart`, `periodEnd`, `value`, `metadataJson`, `createdAt`

### AI/Recommendations (förberedelse)
- `recommendation_events`
  - `id`, `userId`, `contextType`, `contextJson`, `recommendationJson`, `accepted` (nullable), `createdAt`
- `feature_store_user_daily` (senare)
  - `id`, `userId`, `date`, `featuresJson`

> Viktigt: Indexera alltid på `userId`, `recordedAt`, och vanliga filterfält.

---

## 4) Datadelning: rådata vs beräknad data

### Rådata (source of truth)
Sparas oförändrat, append-only så långt det går:
- `shot_entries`
- `user_club_distance_samples`
- `drill_attempts`
- `training_sessions`
- anteckningar/händelser

### Beräknad data (read model)
Kan räknas om från rådata:
- `user_club_distance_stats`
- `user_stat_snapshots`
- framtida feature tabeller

### Rekommenderad strategi
- V1: synkrona beräkningar i service-lagret för enklare KPI:er.
- V1.1+: bakgrundsjobb (queue/cron) för tyngre aggregat.
- Alltid versionssätt metrik-definitioner (ex. `metricKey = carry_avg_v1`) för att undvika datainkompatibilitet när logik ändras.

---

## 5) API-resurser/endpoints för första versionen

Prefix: `/api/v1`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### User/Profile
- `GET /users/me`
- `PATCH /users/me`

### Clubs
- `GET /clubs/catalog`
- `GET /users/me/clubs`
- `POST /users/me/clubs`
- `PATCH /users/me/clubs/:userClubId`
- `DELETE /users/me/clubs/:userClubId`
- `POST /users/me/clubs/:userClubId/distance-samples`
- `GET /users/me/clubs/:userClubId/stats`

### Training Sessions
- `GET /training-sessions`
- `POST /training-sessions`
- `GET /training-sessions/:id`
- `PATCH /training-sessions/:id`
- `POST /training-sessions/:id/complete`

### Drills
- `GET /drills`
- `POST /drill-attempts`
- `GET /drill-attempts`
- `GET /drill-attempts/:id`

### Shots
- `POST /shot-entries`
- `GET /shot-entries` (filter: date range, club, session, drill)
- `PATCH /shot-entries/:id`
- `DELETE /shot-entries/:id`

### Stats
- `GET /stats/overview?range=30d`
- `GET /stats/clubs/:userClubId/trend?range=90d`
- `GET /stats/drills/:drillId/performance?range=90d`

**Säkerhet:** varje endpoint använder auth middleware + user scoping i query-lagret.

---

## 6) Rekommenderad mappstruktur

### Backend (Node + TS)

```txt
backend/
  src/
    app.ts
    server.ts
    config/
      env.ts
    common/
      errors/
      middleware/
      utils/
      validation/
    modules/
      auth/
        auth.routes.ts
        auth.controller.ts
        auth.service.ts
        auth.repository.ts
        auth.schema.ts
      users/
      clubs/
      training/
      drills/
      shots/
      stats/
    prisma/
      schema.prisma
      migrations/
  tests/
```

### Frontend (Expo + TS)

```txt
mobile/
  src/
    app/
      navigation/
      providers/
    features/
      auth/
        screens/
        hooks/
        api/
        types.ts
      profile/
      clubs/
      training/
      drills/
      shots/
      stats/
    shared/
      components/
      ui/
      lib/
      api/
      store/
      constants/
      types/
```

Tips:
- Feature-baserad struktur i frontend.
- API-klient + token-hantering i `shared/api`.
- Ingen domänlogik i UI-komponenter.

---

## 7) Förbered systemet för framtida AI/rekommendationer

1. **Logga beslutsunderlag nu**
   - Spara kontext: klubba, distansmål, utfall, pass-typ, tidsstämpel.
2. **Skapa stabila domänhändelser**
   - Ex: `ShotRecorded`, `DrillAttemptCompleted`, `SessionCompleted`.
3. **Bygg recommendation boundary**
   - Ett interface i backend: `RecommendationService.getSuggestion(context)`.
4. **Separera inferens från API**
   - API frågar service; service kan senare anropa intern modell/mikrotjänst.
5. **Feature readiness**
   - Definiera enkla features tidigt (rolling avg carry, miss bias, drill consistency).
6. **Feedback loop**
   - Spara om rekommendation följdes och resultatet efteråt.
7. **Model governance light**
   - Versionssätt rekommendationer (`strategy_v1`, `club_fit_v2`) i datat.

---

## 8) MVP-scope och vad som inte bör byggas ännu

### Bygg i MVP (nu)
- Auth + profile.
- Clubs + distance samples.
- Training sessions.
- Drill attempts med `successCount/attemptCount`.
- Shot entries (manuell inmatning).
- Grundläggande statistik-endpoints (trend + summary).
- Robust user data isolation och audit-fält (`createdAt`, `updatedAt`).

### Vänta med (senare)
- Realtidsrekommendationer i appflödet.
- Avancerad ML pipeline och feature store i full skala.
- Komplex social funktionalitet (feeds, delning, coach marketplace).
- Offline-first sync med konfliktlösning (kan planeras men ej fullt byggas i V1).
- Tung event-driven microservice-arkitektur.

---

## Praktiska teknikval (kort)
- **Express/Fastify**: välj en och håll enhetlig middleware-struktur.
- **Prisma**: använd repositories per modul, undvik Prisma direkt i controllers.
- **Zod**: request validation i route-lager, delade schema-typer till service vid behov.
- **JWT**: kortlivad access token, roterande refresh tokens (hashade i DB).
- **Observability**: strukturera loggar med request-id och user-id (utan känsliga fält).

Detta ger en enkel men framtidssäker grund där AI kan adderas stegvis utan att ni behöver riva upp kärnmodellen.
