import SwiftUI

/// The play flow once paired: routes loading / empty / playing / error,
/// silently refreshes on wrist raise, flushes strokes on background, and returns
/// to pairing if auth is lost.
struct PlayView: View {
    @StateObject private var viewModel: RoundViewModel
    @ObservedObject private var session = WatchSessionManager.shared
    @Environment(\.scenePhase) private var scenePhase
    private let onSignedOut: () -> Void

    init(service: RoundService, location: LocationManager, onSignedOut: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: RoundViewModel(service: service, location: location))
        self.onSignedOut = onSignedOut
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
        // Wrist raise / reactivation → silent refresh; leaving → flush strokes.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await viewModel.refresh() }
            } else {
                Task { await viewModel.flushPendingStrokes() }
            }
        }
        .onChange(of: session.hasToken) { _, hasToken in
            if hasToken { Task { await viewModel.refresh() } }
        }
        // Auth lost and not refreshable → back to pairing.
        .onChange(of: viewModel.needsPairing) { _, needs in
            if needs { onSignedOut() }
        }
    }
}
