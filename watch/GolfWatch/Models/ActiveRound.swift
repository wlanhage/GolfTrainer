import Foundation

/// Response shape of `GET /api/rounds/active`.
///
/// We only model what the watch needs for the MVP: the round id (for the
/// strokes / next-hole calls) and the hole currently in play.
struct ActiveRound: Codable, Identifiable, Equatable {
    let id: String
    let holeCount: Int?
    let currentHole: Hole

    enum CodingKeys: String, CodingKey {
        // The backend may call this `roundId`; map it to `id`.
        case id = "roundId"
        case holeCount
        case currentHole
    }
}

/// One row of the end-of-round scorecard.
struct ScorecardRow: Codable, Identifiable {
    let holeNumber: Int
    let par: Int
    let strokes: Int?

    var id: Int { holeNumber }
}

struct ScorecardResponse: Codable {
    let rows: [ScorecardRow]
}
