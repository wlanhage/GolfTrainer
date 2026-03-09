# Statistiklager – design för GolfTrainer

Denna design håller MVP enkel, korrekt och framtidssäker för recommendations/AI.

## 1) On-demand vs cache/materialisering

## On-demand i MVP (nu)
Beräkna direkt från rådata i request-flödet för:
- average carry per club
- success rate per drill
- dashboard overview (antal shots/sessions + drill success)
- trend 30 dagar (daglig aggregatserie)

Varför:
- enklare implementation
- inga sync-problem mellan rådata och snapshots i tidig fas
- lättare att verifiera korrekthet

## Materialisera/cacha senare
När datamängd ökar:
- skriv dagliga snapshots till `UserMetricSnapshot`
- inför Redis-cache för tunga läsningar (ttl t.ex. 5–15 min)
- kör asynkrona jobs (cron/queue) för precompute av trendserier

Bra första kandidater för materialisering:
- drill success per drill senaste 30/90 dagar
- average carry per club per vecka
- dashboard overview-card data

---

## 2) Stats-modul i backend

Kodstruktur:
- `stats.routes.ts` – REST endpoints
- `stats.controller.ts` – parse query + user context
- `stats.service.ts` – affärslogik/format
- `stats.repository.ts` – Prisma queries och SQL-aggregat
- `stats.schema.ts` – Zod query schemas

Viktigt:
- alla endpoints skyddas av `requireAuth`
- alla queries filtreras på `userId`

---

## 3) Service-funktioner (implementerade)

### A) Average carry per club
- Källa: `ShotEntry` med `carryMeters != null`
- Grupp: `userClubId`
- Resultat: `averageCarryMeters`, `sampleSize`, `clubLabel`

### B) Success percentage per drill
- Källa: `DrillAttempt`
- Summera `successCount` och `attemptCount` per `drillId`
- Returnera `successPercentage = success / total * 100`

### C) Trend senaste 30 dagarna
- Daglig shot-serie: antal shots + avg carry
- Daglig drill-serie: success/attempt + success%
- Merge till en gemensam tidsserie för dashboard och AI-features

---

## 4) Föreslagna stats-endpoints

Prefix: `/api/v1/stats`
- `GET /overview?rangeDays=30`
- `GET /clubs/average-carry?rangeDays=30`
- `GET /drills/success-rate?rangeDays=30`
- `GET /trends?rangeDays=30`

Exempel use-cases:
- dashboard cards
- clubscreen statistik
- drill progress screen
- trend graph

---

## 5) AI/recommendations-readiness

Statistiklagret är byggt för att senare mata recommendations:
- rådata ligger kvar i `ShotEntry` och `DrillAttempt`
- trendserier ger enkla features (form, consistency, recent performance)
- samma service-kontrakt kan senare byta datakälla till snapshots utan att bryta API

Feature-idéer (senare):
- rolling avg carry per club (7/30 dagar)
- miss-trend och dispersion proxy
- drill consistency score
- session cadence (träningsfrekvens)

