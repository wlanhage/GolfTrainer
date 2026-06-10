import CoreLocation

/// A lat/lng pair as returned by the backend (`{ "lat": 57.1, "lng": 12.1 }`).
struct Coordinate: Codable, Equatable {
    let lat: Double
    let lng: Double

    var clLocation: CLLocation {
        CLLocation(latitude: lat, longitude: lng)
    }
}
