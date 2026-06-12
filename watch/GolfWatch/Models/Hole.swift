import Foundation

/// The hole currently being played. `greenFront` / `greenBack` are optional so
/// the view still renders if the backend hasn't geo-tagged the green yet.
struct Hole: Codable, Identifiable, Equatable {
    let id: String
    let number: Int
    let par: Int
    let strokes: Int
    let greenFront: Coordinate?
    let greenBack: Coordinate?

    enum CodingKeys: String, CodingKey {
        case id
        // The backend may call this `holeNumber`; map it to `number`.
        case number = "holeNumber"
        case par
        case strokes
        case greenFront
        case greenBack
    }
}
