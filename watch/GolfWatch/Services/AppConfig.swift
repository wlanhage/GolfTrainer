import Foundation

/// Backend base URL + endpoint paths. Paths match the real Fastify routes added
/// for the watch (`GET /rounds/active`, `PATCH /rounds/:id/holes/:n/strokes`,
/// `POST /rounds/:id/next-hole`), served under the `/api/v1` prefix.
enum AppConfig {
    /// Resolved in order: a `baseURL` override in UserDefaults (for ad-hoc local
    /// dev) → the `API_BASE_URL` build setting from Info.plist (set in
    /// project.yml, public, not a secret) → a hard fallback.
    static var baseURL: String {
        if let override = UserDefaults.standard.string(forKey: "baseURL"), !override.isEmpty {
            return override
        }
        if let fromPlist = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !fromPlist.isEmpty, !fromPlist.contains("$(") {
            return fromPlist
        }
        return "https://golftrainer-backend.onrender.com/api/v1"
    }

    static func activeRound() -> String {
        "/rounds/active"
    }

    static func strokes(roundId: String, holeNumber: Int) -> String {
        "/rounds/\(roundId)/holes/\(holeNumber)/strokes"
    }

    static func nextHole(roundId: String) -> String {
        "/rounds/\(roundId)/next-hole"
    }

    static func prevHole(roundId: String) -> String {
        "/rounds/\(roundId)/prev-hole"
    }

    static func scorecard(roundId: String) -> String {
        "/rounds/\(roundId)/scorecard"
    }

    static func round(roundId: String) -> String {
        "/rounds/\(roundId)"
    }

    // Auth / pairing
    static func pairStart() -> String { "/auth/watch/pair/start" }
    static func pairPoll() -> String { "/auth/watch/pair/poll" }
    static func refresh() -> String { "/auth/refresh" }

    /// DEBUG-only convenience: paste a valid access-token JWT here to test on the
    /// simulator without a paired phone. Just the accessToken — NOT the whole
    /// login JSON. Leave empty in commits. Applied at launch.
    static let devBearerToken = ""
}
