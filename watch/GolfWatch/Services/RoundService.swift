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

    /// `POST /rounds/{roundId}/prev-hole`
    func goToPrevHole(roundId: String) async throws {
        try await api.post(AppConfig.prevHole(roundId: roundId))
    }

    /// `PATCH /rounds/{roundId}` with `{ status: "COMPLETED" }`
    func finishRound(roundId: String) async throws {
        try await api.patch(AppConfig.round(roundId: roundId), body: RoundStatusPayload(status: "COMPLETED"))
    }

    /// `GET /rounds/{roundId}/scorecard`
    func scorecard(roundId: String) async throws -> [ScorecardRow] {
        let response: ScorecardResponse = try await api.get(AppConfig.scorecard(roundId: roundId))
        return response.rows
    }
}

private struct StrokesPayload: Encodable {
    let strokes: Int
}

private struct RoundStatusPayload: Encodable {
    let status: String
}
