# GolfWatch — Apple Watch companion (watchOS, SwiftUI)

A standalone watchOS app that shows a fast, minimal play view for an **already
started** round. The round is started in the phone/web app; the watch reads the
active round from the backend and lets you bump strokes (Digital Crown) and
advance to the next hole.

> This is a **native Swift project**, separate from the JS/TS monorepo. It does
> not affect the existing CI (which only lints `backend` + `mobile`).

## Architecture (MVVM)

```
GolfWatch/
  App/         GolfWatchApp.swift          @main entry
  Models/      Coordinate, Hole, ActiveRound   Codable DTOs
  Services/    AppConfig                    base URL + endpoint paths
               TokenStore                   bearer token (UserDefaults; see notes)
               APIClient                    generic async/await JSON client
               RoundService                 typed round endpoints
               LocationManager              CoreLocation → published CLLocation
  ViewModels/  RoundViewModel               state, crown→strokes, distances
  Views/       RootView                     state router + composition root
               RoundView                    the play view + Digital Crown
               EmptyRoundView               "Ingen aktiv runda"
               StateViews                   Loading / Error
```

Flow: `View` → observes → `ViewModel` → calls → `Service` → uses → `APIClient` → returns → `Model`.

## Run it

### Option A — XcodeGen (deterministic project)

```bash
brew install xcodegen          # once
cd watch
xcodegen generate
open GolfWatch.xcodeproj
```

Pick an **Apple Watch simulator** and Run.

### Option B — manual (no extra tools)

1. Xcode → File → New → Project → **watchOS → App**.
   - Product name `GolfWatch`, Interface **SwiftUI**, Language **Swift**.
   - Uncheck tests; it can be a watch-only app.
2. Delete the template `ContentView.swift` / `*App.swift`.
3. Drag the folders under `watch/GolfWatch/` (App, Models, Services, ViewModels,
   Views) into the target ("Copy items if needed", add to the GolfWatch target).
4. In the target's **Info** tab add the key
   `NSLocationWhenInUseUsageDescription` = "Används för att visa avstånd till
   green under rundan." (or use the provided `Info.plist`).

## Configure

- **Backend URL** — edit `Services/AppConfig.swift` (`baseURL`) or set a
  `baseURL` value in `UserDefaults`. Include the `/api/v1` prefix and no
  trailing slash (e.g. `https://api.example.com/api/v1`). The endpoint paths
  already match the real Fastify routes added for the watch.
- **Auth token** — the app reads a bearer token from `TokenStore`
  (UserDefaults key `golftrainer.accessToken`). Two ways to populate it:
  - **Simulator / quick test:** paste a JWT into `AppConfig.devBearerToken`
    (DEBUG-only; applied at launch). Leave it empty in commits.
  - **Real device:** the iPhone app pushes it via **WatchConnectivity** —
    `WatchSessionManager` listens for `["accessToken": "<jwt>"]` from
    `updateApplicationContext`/`transferUserInfo` and saves it. When a token
    arrives after launch the UI refreshes automatically.

  iOS sender side (the phone app is Expo/React Native, so use a native module
  such as [`react-native-watch-connectivity`](https://github.com/mtford90/react-native-watch-connectivity)):
  ```ts
  import { updateApplicationContext } from 'react-native-watch-connectivity';
  updateApplicationContext({ accessToken: tokens.accessToken });
  ```
  In production prefer the **Keychain** over UserDefaults for the stored token.

## API contract (as implemented)

All paths are relative to `<host>/api/v1` and require a Bearer token.

| Call | Method | Path | Body |
|------|--------|------|------|
| Active round | GET | `/rounds/active` | — (404 → "no active round") |
| Update strokes | PATCH | `/rounds/{roundId}/holes/{holeNumber}/strokes` | `{ "strokes": 4 }` |
| Next hole | POST | `/rounds/{roundId}/next-hole` | — |

`GET /rounds/active` response (assembled by the backend; the watch user's
strokes for the current hole, plus front/back green derived from the hole
layout):

```json
{
  "roundId": "abc",
  "currentHole": {
    "id": "roundhole_1",
    "holeNumber": 7,
    "par": 4,
    "strokes": 3,
    "greenFront": { "lat": 57.123, "lng": 12.123 },
    "greenBack":  { "lat": 57.124, "lng": 12.124 }
  }
}
```

> The backend derives `greenFront` / `greenBack` from `HoleLayout.greenPolygon`
> + bearing (nearest/farthest point along the play direction). If a hole has no
> layout, both are `null` and the watch shows `–`.

## Behaviour notes

- **Digital Crown** updates `strokes` instantly; the backend PATCH is debounced
  ~0.6 s so a spin doesn't fire a request per tick.
- **Distances** are recomputed on every GPS fix via `CLLocation.distance(from:)`
  (meters). They show `–` until the first fix / if the green isn't geo-tagged.
- In the **simulator**, set a location under *Features → Location* (e.g. Custom
  Location) near the seeded green (`57.700, 11.970`) — otherwise distances
  stay `–`.
- **Auto-refresh:** raising the wrist / reopening the app silently reloads the
  active round (no loading flash); same when a token arrives from the phone.
- **Haptics:** advancing to the next hole plays a success/failure tap.

## Out of scope (deferred)

- Complications, maps, scorecard, statistics.
- Offline cache (show the last round instantly while the network call runs).
- Retry/queueing of stroke updates when the network is flaky (currently the
  optimistic value stays and resyncs on the next change/refresh).

These are intentional next steps after the MVP.
