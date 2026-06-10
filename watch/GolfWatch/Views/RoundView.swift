import SwiftUI

/// The play view. Minimal, high-contrast, big numbers — front distance first.
///
/// Layout priority (top → bottom): hole/par · FRONT · BACK · strokes · Next Hole.
struct RoundView: View {
    @ObservedObject var viewModel: RoundViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                header
                Divider().opacity(0.3)
                DistanceView(label: "FRONT", meters: viewModel.frontMeters, emphasized: true)
                DistanceView(label: "BACK", meters: viewModel.backMeters, emphasized: false)
                strokes
                nextHoleButton
            }
            .padding(.horizontal, 6)
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
        VStack(spacing: 0) {
            Text("Hole \(viewModel.holeNumber)")
                .font(.system(size: 17, weight: .semibold, design: .rounded))
            Text("Par \(viewModel.par)")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var strokes: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("STROKES")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
            Spacer()
            Text("\(viewModel.strokes)")
                .font(.system(size: 30, weight: .bold, design: .rounded))
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
                    ProgressView()
                } else {
                    Text("Next Hole")
                        .font(.system(size: 16, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 30)
        }
        .buttonStyle(.borderedProminent)
        .tint(.green)
        .disabled(viewModel.isAdvancing)
        .padding(.top, 2)
    }
}

/// One distance row: small label + big meters value. `emphasized` makes the
/// front distance (the most-used number) the largest element on screen.
private struct DistanceView: View {
    let label: String
    let meters: Int?
    let emphasized: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 52, alignment: .leading)
            Spacer(minLength: 0)
            Text(valueText)
                .font(.system(size: emphasized ? 46 : 32,
                               weight: .heavy,
                               design: .rounded))
                .foregroundStyle(emphasized ? Color.green : Color.primary)
                .contentTransition(.numericText())
            Text("m")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }

    private var valueText: String {
        guard let meters else { return "–" }
        return "\(meters)"
    }
}
