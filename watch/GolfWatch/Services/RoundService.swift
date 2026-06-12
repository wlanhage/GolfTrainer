import Foundation

/// Maps the round-related backend endpoints to typed calls. Keeps `APIClient`
/// generic and the ViewModel free of URL/path knowledge.
struct RoundService {
    let api: APIClient

    /// `GET /api/rounds/active` — nil when there is no active round.
    func activeRound() async throws -> ActiveRound? {
        try await api.getOptional(AppConfig.activeRound())
    }

    /// `PATCH /rounds/{roundId}/holes/{holeNumber}/strokes`  body: `{ "strokes": n }`
    func updateStrokes(roundId: String, holeNumber: Int, strokes: Int) async throws {
        try await api.patch(
            AppConfig.strokes(roundId: roundId, holeNumber: holeNumber),
            body: StrokesPayload(strokes: strokes)
        )
    }

    /// `POST /rounds/{roundId}/next-hole`
    func goToNextHole(roundId: String) async throws {
        try await api.post(AppConfig.nextHole(roundId: roundId))
    }

    /// Fetch a green satellite image by its API-relative path.
    func fetchImage(path: String) async throws -> Data {
        try await api.fetchData(path)
    }
}

private struct StrokesPayload: Encodable {
    let strokes: Int
}
