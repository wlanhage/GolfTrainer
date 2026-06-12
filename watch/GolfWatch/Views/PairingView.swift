import SwiftUI

/// Shown until the watch is paired to an account. Displays a code to type into
/// the web app, and polls in the background until tokens arrive.
struct PairingView: View {
    @StateObject private var viewModel: PairingViewModel

    init(service: PairingService, tokens: TokenStore, onPaired: @escaping () -> Void) {
        _viewModel = StateObject(
            wrappedValue: PairingViewModel(service: service, tokens: tokens, onPaired: onPaired)
        )
    }

    var body: some View {
        VStack(spacing: 8) {
            switch viewModel.state {
            case .loading:
                ProgressView()
                Text("Förbereder…")
                    .font(.caption)
                    .foregroundStyle(.secondary)

            case .waiting(let code):
                Text("Para klockan")
                    .font(.system(size: 15, weight: .semibold))
                Text(code)
                    .font(.system(size: 34, weight: .heavy, design: .monospaced))
                    .kerning(2)
                    .foregroundStyle(.green)
                Text("Ange koden i webappen")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text("Väntar…").font(.caption2).foregroundStyle(.secondary)
                }
                .padding(.top, 2)

            case .error(let message):
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 24))
                    .foregroundStyle(.yellow)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Försök igen") { Task { await viewModel.start() } }
                    .buttonStyle(.bordered)
            }
        }
        .padding()
        .task { await viewModel.start() }
        .onDisappear { viewModel.cancel() }
    }
}
