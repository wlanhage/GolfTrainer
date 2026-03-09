# GolfTrainer databasdesign (PostgreSQL + Prisma)

Denna design är optimerad för:
- MVP-funktioner (auth, profil, clubs, sessions, drills, attempts, shot entries, statistik)
- strikt privat användardata
- rådata-bevarande för framtida analys/AI
- enkel vidareutveckling utan överdesign

## 1) Tabeller/modeller för MVP

### Auth & användare
1. `User`
2. `UserProfile`
3. `RefreshToken`

### Klubbor & distanser
4. `ClubCatalog` (global katalog av standardklubbor)
5. `UserClub` (användarens faktiska klubbor)
6. `UserClubDistanceSample` (rå historik per klubba)
7. `UserClubDistanceSnapshot` (aggregerad/nuvarande uppskattning)

### Träning, drills, slag
8. `PracticeSession`
9. `Drill`
10. `DrillAttempt`
11. `ShotEntry`

### Statistik
12. `UserMetricSnapshot` (aggregerade tidsseriemått)

### AI/rekommendation-förberedelse (MVP-light)
13. `RecommendationLog` (loggar rekommendation + feedback)
14. `DomainEvent` (domänhändelser för historik/feature engineering)

---

## 2) Relationer mellan modeller

- `User 1-1 UserProfile`
- `User 1-N RefreshToken`
- `User 1-N UserClub`
- `ClubCatalog 1-N UserClub` (valfri FK, för custom klubbnamn)
- `UserClub 1-N UserClubDistanceSample`
- `UserClub 1-N UserClubDistanceSnapshot`
- `User 1-N PracticeSession`
- `User 1-N DrillAttempt`
- `Drill 1-N DrillAttempt`
- `PracticeSession 1-N DrillAttempt` (valfri koppling)
- `User 1-N ShotEntry`
- `PracticeSession 1-N ShotEntry` (valfri)
- `DrillAttempt 1-N ShotEntry` (valfri)
- `UserClub 1-N ShotEntry`
- `User 1-N UserMetricSnapshot`
- `User 1-N RecommendationLog`
- `User 1-N DomainEvent`

> Viktigt: Även när FK-kedjan leder till user ska user-nära tabeller innehålla `userId` för enkel säker filtrering och indexering.

---

## 3) Obligatoriska vs valfria fält

### Auth/User
- `User.email`, `User.passwordHash` är obligatoriska.
- `UserProfile.displayName` obligatorisk i profile (kan initialiseras från email-localpart).
- `UserProfile.handicap`, `dominantHand`, `goals` valfria.
- `RefreshToken.revokedAt`, `replacedByTokenId`, `ip`, `userAgent` valfria.

### Clubs
- `ClubCatalog.name`, `category` obligatoriska.
- `ClubCatalog.loft` valfri.
- `UserClub.label` obligatorisk.
- `UserClub.clubCatalogId` valfri (custom klubba tillåts).

### Distanshistorik
- `UserClubDistanceSample.carryMeters` obligatorisk.
- `totalMeters`, `dispersionMeters`, `notes` valfria.
- `source` obligatorisk (MANUAL, LAUNCH_MONITOR etc).

### Distanser (nuvarande/aggregerat)
- Snapshot bör kräva: `window`, `sampleSize`, `avgCarryMeters`.
- Percentiler/std dev kan vara valfria i tidig MVP.

### Sessions/Drills/Shots
- `PracticeSession.startedAt` obligatorisk, `endedAt` valfri tills pass stängs.
- `Drill.name`, `metricType` obligatoriska.
- `DrillAttempt.attemptCount` obligatorisk (>0), `successCount` obligatorisk (>=0).
- `ShotEntry.recordedAt`, `userClubId` obligatoriska.
- `ShotEntry.carryMeters`, `totalMeters`, `resultTag`, `notes` valfria (alla slag har inte full mätning i MVP).

### Statistik
- `UserMetricSnapshot.metricKey`, `periodStart`, `periodEnd`, `valueNumeric` obligatoriska.
- `valueJson` valfri för mer komplexa KPI:er.

---

## 4) createdAt/updatedAt policy

- `createdAt` på samtliga tabeller.
- `updatedAt` på tabeller som uppdateras över tid:
  - `User`, `UserProfile`, `UserClub`, `PracticeSession`, `Drill`, `DrillAttempt`, `ShotEntry`, `UserClubDistanceSnapshot`.
- På append-only tabeller kan `updatedAt` vara optional eller utelämnas:
  - `UserClubDistanceSample`, `DomainEvent`, `RecommendationLog`, `UserMetricSnapshot`, `RefreshToken`.

---

## 5) Rådata vs aggregerad data

### Rådata-tabeller (source of truth)
- `UserClubDistanceSample`
- `ShotEntry`
- `DrillAttempt`
- `PracticeSession`
- `DomainEvent`

### Aggregerade/read-model-tabeller
- `UserClubDistanceSnapshot`
- `UserMetricSnapshot`

Strategi:
- skriv alltid rådata först
- bygg snapshots synkront för enkel MVP eller asynkront med cron/queue senare
- versionssätt metrics/rekommendationer (`metricVersion`, `modelVersion`)

---

## 6) AI/rekommendation-förberedelse

Minimikrav i schema:
- konsekvent tidsstämpling (`recordedAt`, `createdAt`)
- domänhändelser i `DomainEvent` med `eventType` + `payloadJson`
- `RecommendationLog` med `contextJson`, `recommendationJson`, `modelVersion`, `acceptedAt`
- shot/drill data tillräckligt granular för framtida feature engineering

Detta räcker för att senare bygga:
- rekommendationstjänst (t.ex. klubbval)
- träningsstrategi-beslut baserat på historik
- A/B-test av rekommendationsversioner

---

## 7) Constraints, indexes och FK

### Viktiga constraints
- unique: `User.email`
- unique: `UserProfile.userId`
- unique: `RefreshToken.tokenHash`
- check: `DrillAttempt.attemptCount > 0`
- check: `DrillAttempt.successCount >= 0 AND successCount <= attemptCount`
- check: distance-fält `>= 0`

### Viktiga index
- alla användar-tabeller: index på `userId`
- tidsserie: composite `(userId, recordedAt)` / `(userId, createdAt)`
- filters:
  - `ShotEntry(userId, userClubId, recordedAt)`
  - `DrillAttempt(userId, drillId, createdAt)`
  - `UserClubDistanceSample(userId, userClubId, recordedAt)`
  - `UserMetricSnapshot(userId, metricKey, periodStart)`

### FK-regler
- `onDelete: Cascade` från `User` till privata child-tabeller.
- `onDelete: SetNull` där historik bör bevaras trots borttagen parent i katalog (`clubCatalogId`).
- `onDelete: Restrict` för känsliga länkar om ni vill undvika oavsiktlig historikförlust.

---

## 8) Första Prisma-schema

Se `prisma/schema.prisma`.

