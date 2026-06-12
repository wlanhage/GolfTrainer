import SwiftUI

/// Palette tuned to the high-contrast "golf watch" look: black screen, a vivid
/// green front distance, white secondary numbers, muted grey labels.
private enum Theme {
    static let front = Color(red: 0.592, green: 0.769, blue: 0.349)      // #97C459
    static let action = Color(red: 0.204, green: 0.780, blue: 0.349)     // #34C759
    static let actionText = Color(red: 0.024, green: 0.165, blue: 0.071) // #062A12
    static let muted = Color(red: 0.557, green: 0.557, blue: 0.576)      // #8E8E93
}

/// The play view. Minimal, high-contrast, big numbers — front distance first.
///
/// Layout priority (top → bottom): hole/par · FRONT · BACK · strokes · Next Hole.
struct RoundView: View {
    @ObservedObject var viewModel: RoundViewModel
    @State private var showGreen = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                header
                Divider().overlay(Color.white.opacity(0.12))
                DistanceView(label: "FRONT", meters: viewModel.frontMeters, emphasized: true)
                DistanceView(label: "BACK", meters: viewModel.backMeters, emphasized: false)
                strokes
                nextHoleButton
            }
            .padding(.horizontal, 8)
            .padding(.top, 2)
        }
        .overlay(alignment: .topTrailing) {
            if viewModel.greenImageURLPath != nil {
                Button { showGreen = true } label: {
                    Image(systemName: "map.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.front)
                        .padding(6)
                        .background(.black.opacity(0.45), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(.trailing, 2)
            }
        }
        .sheet(isPresented: $showGreen) {
            GreenView(viewModel: viewModel)
        }
        // Digital Crown adjusts the stroke count. The view must be focusable.
        .focusable(true)
        .digitalCrownRotation(
            $viewModel.crownValue,
            from: 0,
            through: 30,
            by: 1,
            sensitivity: .low,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .onChange(of: viewModel.crownValue) { _, newValue in
            viewModel.crownChanged(to: newValue)
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(spacing: 1) {
            Text("Hole \(viewModel.holeNumber)")
                .font(.system(size: 19, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
            Text("Par \(viewModel.par)")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private var strokes: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("STROKES")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.muted)
            Spacer()
            Text("\(viewModel.strokes)")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .contentTransition(.numericText())
        }
        .padding(.top, 2)
    }

    private var nextHoleButton: some View {
        Button {
            Task { await viewModel.nextHole() }
        } label: {
            Group {
                if viewModel.isAdvancing {
                    ProgressView().tint(Theme.actionText)
                } else {
                    Text("Next Hole").font(.system(size: 15, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(Theme.action)
            .foregroundStyle(Theme.actionText)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isAdvancing)
        .padding(.top, 4)
    }
}

/// One distance row: small label + big meters value. `emphasized` makes the
/// front distance (the most-used number) the largest, green element on screen.
private struct DistanceView: View {
    let label: String
    let meters: Int?
    let emphasized: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .frame(width: 48, alignment: .leading)
            Spacer(minLength: 0)
            Text(valueText)
                .font(.system(size: emphasized ? 46 : 32,
                               weight: .heavy,
                               design: .rounded))
                .foregroundStyle(emphasized ? Theme.front : .white)
                .contentTransition(.numericText())
            Text("m")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.muted)
        }
    }

    private var valueText: String {
        guard let meters else { return "–" }
        return "\(meters)"
    }
}
