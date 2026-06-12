import Foundation

struct PairStartResponse: Decodable {
    let code: String
    let deviceSecret: String
    let expiresInSeconds: Int
}

struct PairPollResponse: Decodable {
    let status: String // pending | approved | expired | consumed
    let accessToken: String?
    let refreshToken: String?
}

/// Device-code pairing: the watch shows `code`, the user enters it in the web
/// app, and the watch polls until tokens are issued.
struct PairingService {
    let api: APIClient

    func start() async throws -> PairStartResponse {
        try await api.post(AppConfig.pairStart())
    }

    func poll(deviceSecret: String) async throws -> PairPollResponse {
        try await api.post(AppConfig.pairPoll(), body: DeviceSecretPayload(deviceSecret: deviceSecret))
    }
}

private struct DeviceSecretPayload: Encodable {
    let deviceSecret: String
}
