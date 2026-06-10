import SwiftUI

/// App entry point. Composes the dependency graph once and hands it to the root
/// view. Everything below is plain MVVM: Views observe ViewModels, ViewModels
/// talk to Services, Services map to Models.
@main
struct GolfWatchApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
