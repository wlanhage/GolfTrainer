import SwiftUI

/// End-of-round scorecard: a scrollable list of hole + score, then a button to
/// return to the standby screen (waiting for a new round from the phone).
struct ScorecardView: View {
    @ObservedObject var viewModel: RoundViewModel
    @Environment(\.dismiss) private var dismiss

    private var total: Int {
        viewModel.scorecard.compactMap(\.strokes).reduce(0, +)
    }

    var body: some View {
        List {
            Section {
                ForEach(viewModel.scorecard) { row in
                    HStack {
                        Text("Hole \(row.holeNumber)")
                            .font(.system(size: 15, weight: .medium))
                        Spacer()
                        Text(row.strokes.map { "\($0)" } ?? "–")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
            } header: {
                Text("Scorecard")
            }

            HStack {
                Text("Total").font(.system(size: 15, weight: .semibold))
                Spacer()
                Text("\(total)").font(.system(size: 17, weight: .bold, design: .rounded))
            }

            Button {
                Task {
                    await viewModel.startNewRound()
                    dismiss()
                }
            } label: {
                Text("New round")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.green)
            .foregroundStyle(.black)
        }
    }
}
