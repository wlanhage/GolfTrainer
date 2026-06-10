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
final class APIClient {
    private let baseURL: URL
    private let token: TokenProviding
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(
        baseURL: URL = AppConfig.baseURL,
        token: TokenProviding,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Public verbs

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path: path, method: "GET", body: Optional<Empty>.none)
    }

    /// Like `get`, but treats HTTP 404 as "nothing there" (→ nil) rather than an
    /// error. Used for `GET /rounds/active` when no round is in progress.
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

    func patch<B: Encodable>(_ path: String, body: B) async throws {
        let _: Empty = try await perform(path: path, method: "PATCH", body: body)
    }

    // MARK: - Core

    private func perform<B: Encodable, T: Decodable>(
        path: String,
        method: String,
        body: B?
    ) async throws -> T {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = token.accessToken {
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

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch http.statusCode {
        case 200..<300:
            break
        case 401:
            throw APIError.unauthorized
        default:
            throw APIError.server(status: http.statusCode)
        }

        // Endpoints that return no/empty body (e.g. PATCH strokes, POST next-hole).
        if data.isEmpty, let empty = Empty() as? T {
            return empty
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
