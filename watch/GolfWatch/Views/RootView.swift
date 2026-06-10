import SwiftUI

/// Composition root + state router. Builds the dependency graph and shows the
/// right screen for the current `ViewState`.
struct RootView: View {
    @StateObject private var viewModel: RoundViewModel

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
    }
}
