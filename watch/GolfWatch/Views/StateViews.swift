import SwiftUI

/// Shown while the active round is loading.
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Laddar runda…")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

/// Shown when a request fails. Offers a retry.
struct ErrorView: View {
    let message: String
    var onRetry: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 28))
                .foregroundStyle(.yellow)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Försök igen", action: onRetry)
                .buttonStyle(.bordered)
        }
        .padding()
    }
}
