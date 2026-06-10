import Foundation
import Combine
import CoreLocation

/// Drives the play view. Owns the active round, the (optimistic) stroke count,
/// and the computed green distances. All UI mutations happen on the main actor.
@MainActor
final class RoundViewModel: ObservableObject {

    enum ViewState: Equatable {
        case loading
        case empty
        case playing
        case error(String)
    }

    // MARK: - Published state

    @Published private(set) var state: ViewState = .loading
    @Published private(set) var round: ActiveRound?

    /// Source of truth for the UI. Updated immediately on crown input, then
    /// pushed to the backend (debounced).
    @Published var strokes: Int = 0
    /// Bound to the Digital Crown. Kept as a Double per the SwiftUI API.
    @Published var crownValue: Double = 0

    @Published private(set) var frontMeters: Int?
    @Published private(set) var backMeters: Int?
    @Published private(set) var isAdvancing = false

    // MARK: - Dependencies

    private let service: RoundService
    private let location: LocationManager
    private var cancellables = Set<AnyCancellable>()
    private var strokeSaveTask: Task<Void, Never>?

    init(service: RoundService, location: LocationManager) {
        self.service = service
        self.location = location

        // Recompute distances whenever a new GPS fix arrives.
        location.$location
            .compactMap { $0 }
            .sink { [weak self] loc in self?.recomputeDistances(from: loc) }
            .store(in: &cancellables)
    }

    // MARK: - Derived

    var holeNumber: Int { round?.currentHole.number ?? 0 }
    var par: Int { round?.currentHole.par ?? 0 }

    // MARK: - Lifecycle

    func onAppear() async {
        location.start()
        await load()
    }

    func load() async {
        state = .loading
        do {
            if let round = try await service.activeRound() {
                apply(round)
                state = .playing
            } else {
                self.round = nil
                state = .empty
            }
        } catch {
            state = .error(Self.message(for: error))
        }
    }

    private func apply(_ round: ActiveRound) {
        self.round = round
        strokes = round.currentHole.strokes
        crownValue = Double(round.currentHole.strokes)
        if let loc = location.location {
            recomputeDistances(from: loc)
        } else {
            frontMeters = nil
            backMeters = nil
        }
    }

    // MARK: - Digital Crown → strokes

    func crownChanged(to value: Double) {
        let newValue = max(0, Int(value.rounded()))
        guard newValue != strokes else { return }
        strokes = newValue           // immediate UI update
        scheduleStrokeSave(newValue) // debounced backend update
    }

    private func scheduleStrokeSave(_ value: Int) {
        strokeSaveTask?.cancel()
        strokeSaveTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000) // 0.6s debounce
            guard let self, !Task.isCancelled else { return }
            await self.saveStrokes(value)
        }
    }

    private func saveStrokes(_ value: Int) async {
        guard let round else { return }
        do {
            try await service.updateStrokes(
                roundId: round.id,
                holeId: round.currentHole.id,
                strokes: value
            )
        } catch {
            // Keep the optimistic value; a later change or reload will resync.
        }
    }

    // MARK: - Next hole

    func nextHole() async {
        guard let round, !isAdvancing else { return }
        isAdvancing = true
        defer { isAdvancing = false }

        strokeSaveTask?.cancel() // flush any pending debounce intent
        do {
            try await service.goToNextHole(roundId: round.id)
            await load() // reload active round → shows the next hole
        } catch {
            state = .error(Self.message(for: error))
        }
    }

    // MARK: - Distances

    private func recomputeDistances(from loc: CLLocation) {
        guard let hole = round?.currentHole else { return }
        frontMeters = hole.greenFront.map { Int(loc.distance(from: $0.clLocation).rounded()) }
        backMeters = hole.greenBack.map { Int(loc.distance(from: $0.clLocation).rounded()) }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? "Något gick fel"
    }
}
