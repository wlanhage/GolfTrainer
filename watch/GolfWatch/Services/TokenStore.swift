import Foundation

/// Read access to the bearer token for API calls.
protocol TokenProviding {
    var accessToken: String? { get }
}

/// Stores the access + refresh token pair (from pairing or refresh).
///
/// UserDefaults is fine for an MVP; in production prefer the Keychain.
struct TokenStore: TokenProviding {
    private let accessKey = "golftrainer.accessToken"
    private let refreshKey = "golftrainer.refreshToken"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var accessToken: String? { nonEmpty(accessKey) }
    var refreshToken: String? { nonEmpty(refreshKey) }

    /// True once the watch has been paired (has at least a refresh token).
    var hasTokens: Bool { accessToken != nil || refreshToken != nil }

    func save(access: String, refresh: String) {
        defaults.set(access, forKey: accessKey)
        defaults.set(refresh, forKey: refreshKey)
    }

    /// Update just the access token (after a refresh).
    func saveAccess(_ access: String) {
        defaults.set(access, forKey: accessKey)
    }

    func clear() {
        defaults.removeObject(forKey: accessKey)
        defaults.removeObject(forKey: refreshKey)
    }

    private func nonEmpty(_ key: String) -> String? {
        let value = defaults.string(forKey: key)
        return (value?.isEmpty == false) ? value : nil
    }
}
