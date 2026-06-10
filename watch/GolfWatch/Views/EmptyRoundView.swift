import SwiftUI

/// Shown when `GET /api/rounds/active` reports no active round.
struct EmptyRoundView: View {
    var onRetry: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "flag.slash")
                .font(.system(size: 30))
                .foregroundStyle(.secondary)
            Text("Ingen aktiv runda")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("Starta en runda i mobilappen.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Uppdatera", action: onRetry)
                .buttonStyle(.bordered)
        }
        .padding()
    }
}
