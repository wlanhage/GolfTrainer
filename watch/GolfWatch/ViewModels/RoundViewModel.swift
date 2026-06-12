import Foundation
import Combine
import CoreLocation
import WatchKit

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

    /// End-of-round scorecard, shown after finishing.
    @Published var showScorecard = false
    @Published private(set) var scorecard: [ScorecardRow] = []
    /// Set when auth can't be refreshed → the app should return to pairing.
    @Published private(set) var needsPairing = false

    // MARK: - Dependencies

    private let service: RoundService
    private let location: LocationManager
    private var cancellables = Set<AnyCancellable>()
    private var strokeSaveTask: Task<Void, Never>?
    /// Last stroke count we know the backend has, so we only flush real changes.
    private var savedStrokes: Int = 0

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
    var canGoBack: Bool { holeNumber > 1 }
    var isLastHole: Bool {
        guard let round, let count = round.holeCount else { return false }
        return round.currentHole.number >= count
    }

    /// Strokes cap. 0…10 show the number; the step above 10 shows a dash.
    static let maxStrokes = 11
    var strokesText: String { strokes > 10 ? "–" : "\(strokes)" }

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
            if case APIError.unauthorized = error { needsPairing = true }
            state = .error(Self.message(for: error))
        }
    }

    /// Silent reload — keeps the current view on screen (no loading spinner).
    /// Used on wrist raise / when the scene becomes active, and after a token
    /// arrives from the phone. Transient failures keep existing data visible.
    func refresh() async {
        do {
            if let round = try await service.activeRound() {
                apply(round)
                state = .playing
            } else {
                self.round = nil
                state = .empty
            }
        } catch {
            if round == nil { state = .error(Self.message(for: error)) }
        }
    }

    private func apply(_ round: ActiveRound) {
        self.round = round
        strokes = min(Self.maxStrokes, round.currentHole.strokes)
        savedStrokes = strokes
        crownValue = Double(strokes)
        if let loc = location.location {
            recomputeDistances(from: loc)
        } else {
            frontMeters = nil
            backMeters = nil
        }
    }

    // MARK: - Digital Crown → strokes

    func crownChanged(to value: Double) {
        let newValue = min(Self.maxStrokes, max(0, Int(value.rounded())))
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
                holeNumber: round.currentHole.number,
                strokes: value
            )
            savedStrokes = value
        } catch {
            // Keep the optimistic value; a later change or reload will resync.
        }
    }

    /// Flush an unsaved stroke change immediately — call when the app is about
    /// to background / the wrist drops, so a pending debounced save isn't lost.
    func flushPendingStrokes() async {
        guard round != nil, strokes != savedStrokes else { return }
        strokeSaveTask?.cancel()
        await saveStrokes(strokes)
    }

    // MARK: - Next hole

    func nextHole() async {
        guard let round, !isAdvancing else { return }
        isAdvancing = true
        defer { isAdvancing = false }

        // Flush the latest stroke count for THIS hole before advancing, so a
        // quick "scroll then Next Hole" (within the debounce window) isn't lost.
        strokeSaveTask?.cancel()
        await saveStrokes(strokes)
        do {
            try await service.goToNextHole(roundId: round.id)
            await load() // reload active round → shows the next hole
            WKInterfaceDevice.current().play(.success)
        } catch {
            WKInterfaceDevice.current().play(.failure)
            state = .error(Self.message(for: error))
        }
    }

    func prevHole() async {
        guard let round, !isAdvancing, canGoBack else { return }
        isAdvancing = true
        defer { isAdvancing = false }
        strokeSaveTask?.cancel()
        await saveStrokes(strokes)
        do {
            try await service.goToPrevHole(roundId: round.id)
            await load()
            WKInterfaceDevice.current().play(.click)
        } catch {
            WKInterfaceDevice.current().play(.failure)
            state = .error(Self.message(for: error))
        }
    }

    // MARK: - Finish round

    func finishRound() async {
        guard let round, !isAdvancing else { return }
        isAdvancing = true
        defer { isAdvancing = false }
        strokeSaveTask?.cancel()
        await saveStrokes(strokes)
        do {
            try await service.finishRound(roundId: round.id)
            scorecard = (try? await service.scorecard(roundId: round.id)) ?? []
            showScorecard = true
            WKInterfaceDevice.current().play(.success)
        } catch {
            WKInterfaceDevice.current().play(.failure)
            state = .error(Self.message(for: error))
        }
    }

    /// After the scorecard: back to the standby screen, waiting for a new round.
    func startNewRound() async {
        showScorecard = false
        scorecard = []
        await load() // round is COMPLETED → no active round → empty/standby
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
