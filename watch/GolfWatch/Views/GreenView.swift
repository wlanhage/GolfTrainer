import SwiftUI

/// Full-screen satellite image of the current green (play direction up). Loaded
/// from the backend with the bearer token; pinch/scroll isn't needed — it's a
/// quick glance.
struct GreenView: View {
    @ObservedObject var viewModel: RoundViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else if failed {
                VStack(spacing: 6) {
                    Image(systemName: "photo.slash").font(.system(size: 24)).foregroundStyle(.secondary)
                    Text("Ingen green-bild").font(.caption).foregroundStyle(.secondary)
                }
            } else {
                ProgressView()
            }
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .padding(7)
                    .background(.black.opacity(0.5), in: Circle())
            }
            .buttonStyle(.plain)
            .padding(6)
        }
        .task {
            if let data = await viewModel.loadGreenImage(), let ui = UIImage(data: data) {
                image = ui
            } else {
                failed = true
            }
        }
    }
}
