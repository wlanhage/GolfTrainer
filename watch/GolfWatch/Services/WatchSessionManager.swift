import Foundation
import WatchConnectivity

/// Receives the auth token from the paired iPhone over WatchConnectivity and
/// stores it via `TokenStore`.
///
/// The iOS side should send `["accessToken": "<jwt>"]` using
/// `WCSession.updateApplicationContext(_:)` (preferred — always the latest
/// value) or `transferUserInfo(_:)`. With Expo/React Native this is wired up
/// with a native module such as `react-native-watch-connectivity`.
///
/// For simulator testing without a phone, use `AppConfig.devBearerToken`.
final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    private let tokenStore = TokenStore()

    /// Flips to true once a token is available (from the phone or dev override),
    /// so the UI can refresh after a late-arriving token.
    @Published private(set) var hasToken: Bool = false

    private override init() {
        super.init()
        hasToken = tokenStore.accessToken?.isEmpty == false
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    private func handle(_ payload: [String: Any]) {
        guard let token = payload["accessToken"] as? String, !token.isEmpty else { return }
        tokenStore.save(token)
        Task { @MainActor in self.hasToken = true }
    }
}

extension WatchSessionManager: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        // Pick up any token already present in the latest application context.
        handle(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handle(applicationContext)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handle(userInfo)
    }
}
