import Foundation

/// Supplies the bearer token for API calls. The spec assumes the user is
/// already authenticated and the token is stored locally.
protocol TokenProviding {
    var accessToken: String? { get }
}

/// UserDefaults-backed token store.
///
/// For an MVP this is fine. In production prefer the Keychain, and populate the
/// token by sending it from the iOS app over `WatchConnectivity`
/// (`WCSession.transferUserInfo` / `updateApplicationContext`).
struct TokenStore: TokenProviding {
    private let key = "golftrainer.accessToken"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var accessToken: String? {
        defaults.string(forKey: key)
    }

    func save(_ token: String) {
        defaults.set(token, forKey: key)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }
}
