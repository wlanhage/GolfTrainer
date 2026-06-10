import Foundation

/// Central place for the backend base URL and endpoint paths.
///
/// NOTE: the web app talks to `<host>/api/v1`, while this spec uses
/// `/api/rounds/...`. Adjust `baseURL` and the paths below to match your real
/// API once you wire it up.
enum AppConfig {
    /// Override at launch with `-AppConfig.baseURL <url>` or by editing here.
    static var baseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: "baseURL"),
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://your-backend.example.com")!
    }

    static func activeRound() -> String {
        "/api/rounds/active"
    }

    static func strokes(roundId: String, holeId: String) -> String {
        "/api/rounds/\(roundId)/holes/\(holeId)/strokes"
    }

    static func nextHole(roundId: String) -> String {
        "/api/rounds/\(roundId)/next-hole"
    }
}
