import Foundation

/// Maps the round-related backend endpoints to typed calls. Keeps `APIClient`
/// generic and the ViewModel free of URL/path knowledge.
struct RoundService {
    let api: APIClient

    /// `GET /api/rounds/active` — nil when there is no active round.
    func activeRound() async throws -> ActiveRound? {
        try await api.getOptional(AppConfig.activeRound())
    }

    /// `PATCH /api/rounds/{roundId}/holes/{holeId}/strokes`  body: `{ "strokes": n }`
    func updateStrokes(roundId: String, holeId: String, strokes: Int) async throws {
        try await api.patch(
            AppConfig.strokes(roundId: roundId, holeId: holeId),
            body: StrokesPayload(strokes: strokes)
        )
    }

    /// `POST /api/rounds/{roundId}/next-hole`
    func goToNextHole(roundId: String) async throws {
        try await api.post(AppConfig.nextHole(roundId: roundId))
    }
}

private struct StrokesPayload: Encodable {
    let strokes: Int
}
