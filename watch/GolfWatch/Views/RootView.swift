import SwiftUI

/// Composition root + state router. Builds the dependency graph and shows the
/// right screen for the current `ViewState`.
struct RootView: View {
    @StateObject private var viewModel: RoundViewModel
    @ObservedObject private var session = WatchSessionManager.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let token = TokenStore()
        let api = APIClient(token: token)
        let service = RoundService(api: api)
        let location = LocationManager()
        _viewModel = StateObject(
            wrappedValue: RoundViewModel(service: service, location: location)
        )
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingView()
            case .empty:
                EmptyRoundView { Task { await viewModel.load() } }
            case .playing:
                RoundView(viewModel: viewModel)
            case .error(let message):
                ErrorView(message: message) { Task { await viewModel.load() } }
            }
        }
        .task { await viewModel.onAppear() }
        // Wrist raise / app reactivation → silent refresh. Wrist down / leaving
        // → flush any unsaved stroke change before the app suspends.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await viewModel.refresh() }
            } else {
                Task { await viewModel.flushPendingStrokes() }
            }
        }
        // Token arrived from the phone after launch → try loading again.
        .onChange(of: session.hasToken) { _, hasToken in
            if hasToken { Task { await viewModel.refresh() } }
        }
    }
}
