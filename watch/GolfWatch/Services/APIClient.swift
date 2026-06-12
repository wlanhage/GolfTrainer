import Foundation

/// Errors surfaced to the UI. `errorDescription` is shown verbatim in `ErrorView`.
enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case server(status: Int)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Ogiltigt svar från servern"
        case .unauthorized: return "Inte inloggad"
        case .server(let status): return "Serverfel (\(status))"
        case .decoding: return "Kunde inte tolka svaret"
        case .transport: return "Nätverksfel"
        }
    }
}

/// Empty payload/response placeholder for requests with no body.
struct Empty: Codable {}

/// A small generic JSON client: async/await, Codable, bearer auth, typed errors.
/// On a 401 it transparently refreshes the access token (via the stored refresh
/// token) once and retries; if that fails the tokens are cleared.
final class APIClient {
    private let baseURL: String
    private let tokens: TokenStore
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: String = AppConfig.baseURL, tokens: TokenStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokens = tokens
        self.session = session
    }

    // MARK: - Public verbs

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path: path, method: "GET", body: Optional<Empty>.none)
    }

    /// Like `get`, but treats HTTP 404 as "nothing there" (→ nil).
    func getOptional<T: Decodable>(_ path: String) async throws -> T? {
        do {
            return try await get(path) as T
        } catch APIError.server(let status) where status == 404 {
            return nil
        }
    }

    func post(_ path: String) async throws {
        let _: Empty = try await perform(path: path, method: "POST", body: Optional<Empty>.none)
    }

    func post<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path: path, method: "POST", body: Optional<Empty>.none)
    }

    func post<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        try await perform(path: path, method: "POST", body: body)
    }

    func patch<B: Encodable>(_ path: String, body: B) async throws {
        let _: Empty = try await perform(path: path, method: "PATCH", body: body)
    }

    // MARK: - Core (with one transparent refresh-and-retry on 401)

    private func perform<B: Encodable, T: Decodable>(path: String, method: String, body: B?) async throws -> T {
        do {
            return try await rawRequest(path: path, method: method, body: body, useBearer: true)
        } catch APIError.unauthorized {
            if await refreshTokens() {
                return try await rawRequest(path: path, method: method, body: body, useBearer: true)
            }
            throw APIError.unauthorized
        }
    }

    private func rawRequest<B: Encodable, T: Decodable>(
        path: String,
        method: String,
        body: B?,
        useBearer: Bool
    ) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidResponse }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if useBearer, let token = tokens.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200..<300: break
        case 401: throw APIError.unauthorized
        default: throw APIError.server(status: http.statusCode)
        }

        if data.isEmpty, let empty = Empty() as? T { return empty }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// Exchange the refresh token for a new pair. Clears tokens on failure.
    private func refreshTokens() async -> Bool {
        guard let refresh = tokens.refreshToken else { return false }
        struct Body: Encodable { let refreshToken: String }
        struct Pair: Decodable { let accessToken: String; let refreshToken: String }
        do {
            let pair: Pair = try await rawRequest(
                path: AppConfig.refresh(),
                method: "POST",
                body: Body(refreshToken: refresh),
                useBearer: false
            )
            tokens.save(access: pair.accessToken, refresh: pair.refreshToken)
            return true
        } catch {
            tokens.clear()
            return false
        }
    }
}
