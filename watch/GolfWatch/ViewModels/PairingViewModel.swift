import Foundation

/// Drives the pairing screen: fetch a code, show it, poll until the web app
/// approves it, then store the tokens and hand off.
@MainActor
final class PairingViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case waiting(code: String)
        case error(String)
    }

    @Published private(set) var state: State = .loading

    private let service: PairingService
    private let tokens: TokenStore
    private let onPaired: () -> Void
    private var deviceSecret: String?
    private var pollTask: Task<Void, Never>?

    init(service: PairingService, tokens: TokenStore, onPaired: @escaping () -> Void) {
        self.service = service
        self.tokens = tokens
        self.onPaired = onPaired
    }

    func start() async {
        pollTask?.cancel()
        state = .loading
        do {
            let response = try await service.start()
            deviceSecret = response.deviceSecret
            state = .waiting(code: response.code)
            startPolling()
        } catch {
            state = .error("Kunde inte starta paring")
        }
    }

    func cancel() {
        pollTask?.cancel()
    }

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000) // poll every 2s
                guard let self, let secret = self.deviceSecret, !Task.isCancelled else { return }

                guard let result = try? await self.service.poll(deviceSecret: secret) else { continue }
                switch result.status {
                case "approved":
                    if let access = result.accessToken, let refresh = result.refreshToken {
                        self.tokens.save(access: access, refresh: refresh)
                        self.onPaired()
                        return
                    }
                case "expired", "consumed":
                    await self.start() // get a fresh code
                    return
                default:
                    break // pending → keep polling
                }
            }
        }
    }
}
