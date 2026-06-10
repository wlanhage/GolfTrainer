import Foundation

/// Central place for the backend base URL and endpoint paths.
///
/// Backend base URL + endpoint paths. Paths match the real Fastify routes added
/// for the watch (`GET /rounds/active`, `PATCH /rounds/:id/holes/:n/strokes`,
/// `POST /rounds/:id/next-hole`), served under the `/api/v1` prefix.
enum AppConfig {
    /// Override at runtime by setting `baseURL` in UserDefaults. Must include the
    /// `/api/v1` prefix and no trailing slash.
    static var baseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: "baseURL"),
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://your-backend.example.com/api/v1")!
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

    /// DEBUG-only convenience: paste a valid JWT here to test on the simulator
    /// without a paired phone. Leave empty in commits. Applied at launch.
    static let devBearerToken = ""
}
