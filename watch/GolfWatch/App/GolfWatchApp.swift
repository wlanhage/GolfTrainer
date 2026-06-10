import SwiftUI

/// App entry point. Composes the dependency graph once and hands it to the root
/// view. Everything below is plain MVVM: Views observe ViewModels, ViewModels
/// talk to Services, Services map to Models.
@main
struct GolfWatchApp: App {
    init() {
        #if DEBUG
        // Simulator convenience: seed a pasted token if one is provided.
        if !AppConfig.devBearerToken.isEmpty {
            TokenStore().save(AppConfig.devBearerToken)
        }
        #endif
        // Start listening for a token pushed from the paired iPhone.
        WatchSessionManager.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
