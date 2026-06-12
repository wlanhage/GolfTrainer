import SwiftUI

/// App entry point. Composes the dependency graph once and hands it to the root
/// view. Everything below is plain MVVM: Views observe ViewModels, ViewModels
/// talk to Services, Services map to Models.
@main
struct GolfWatchApp: App {
    init() {
        #if DEBUG
        // Simulator convenience: a pasted access token skips pairing. (Empty in
        // commits → the pairing screen runs instead.)
        if !AppConfig.devBearerToken.isEmpty {
            TokenStore().saveAccess(AppConfig.devBearerToken)
        }
        #endif
        WatchSessionManager.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
