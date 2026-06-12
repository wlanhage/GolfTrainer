import SwiftUI

/// Composition root + top-level router: pairing until the watch has tokens,
/// then the play flow. Builds the dependency graph once.
struct RootView: View {
    @State private var paired: Bool

    private let tokens: TokenStore
    private let roundService: RoundService
    private let pairingService: PairingService
    private let location: LocationManager

    init() {
        let tokenStore = TokenStore()
        let api = APIClient(tokens: tokenStore)
        tokens = tokenStore
        roundService = RoundService(api: api)
        pairingService = PairingService(api: api)
        location = LocationManager()
        _paired = State(initialValue: tokenStore.hasTokens)
    }

    var body: some View {
        if paired {
            PlayView(service: roundService, location: location, onSignedOut: { paired = false })
        } else {
            PairingView(service: pairingService, tokens: tokens, onPaired: { paired = true })
        }
    }
}
